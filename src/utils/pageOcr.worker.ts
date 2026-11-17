import { createWorker, OEM, PSM } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import { cleanOcrText, joinLabelLines } from './ocr/cleanOcrText';
import { segmentTable } from './ocr/segmentTable';
import type { Region } from './ocr/segmentTable';

type PageOcrRequest = { id: number; image: Blob };

// 칸을 잘라 읽을 때 칸 이미지를 얼마나 키울지(페이지는 약 200dpi로 그려져 와요), 칸 하나의 최대 화소 수예요.
const REGION_SCALE = 2.5;
const REGION_MAX_PIXELS = 24_000_000;
// 표를 못 찾아 페이지 전체를 읽을 때의 목표 가로 화소 수예요.
const FALLBACK_TARGET_WIDTH = 1800;
const FALLBACK_MAX_SCALE = 2.5;
// 언어 데이터는 앱과 같은 곳에서 내려받고(public/tessdata), 한 번 받으면 브라우저에 저장돼요.
const LANG_PATH = `${import.meta.env.BASE_URL}tessdata`;

let engine: Promise<TesseractWorker> | undefined;
let currentMode: PSM | undefined;

// 엔진(언어 데이터 포함)은 첫 페이지에서 한 번만 만들고 모든 페이지가 재사용해요.
function getEngine() {
  engine ??= createWorker(['kor'], OEM.LSTM_ONLY, {
    workerPath,
    workerBlobURL: false,
    langPath: LANG_PATH,
    gzip: true,
    cacheMethod: 'write',
  });
  return engine;
}

async function setMode(worker: TesseractWorker, mode: PSM) {
  if (currentMode === mode) return;
  await worker.setParameters({ tessedit_pageseg_mode: mode });
  currentMode = mode;
}

async function readCanvas(worker: TesseractWorker, canvas: OffscreenCanvas, mode: PSM): Promise<string> {
  await setMode(worker, mode);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const { data } = await worker.recognize(new Uint8Array(await blob.arrayBuffer()));
  return data.text;
}

function toGray(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = ((data[p] ?? 0) * 299 + (data[p + 1] ?? 0) * 587 + (data[p + 2] ?? 0) * 114) / 1000;
  }
  return gray;
}

function scaledCanvas(source: OffscreenCanvas, sx: number, sy: number, sw: number, sh: number, scale: number): OffscreenCanvas {
  const limit = Math.sqrt(REGION_MAX_PIXELS / (sw * sh));
  const factor = Math.min(scale, limit);
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(sw * factor)), Math.max(1, Math.round(sh * factor)));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function readRegion(worker: TesseractWorker, page: OffscreenCanvas, region: Region): Promise<string> {
  const crop = scaledCanvas(page, region.x, region.y, region.width, region.height, REGION_SCALE);
  const text = await readCanvas(worker, crop, PSM.SINGLE_BLOCK);
  return region.kind === 'label' ? joinLabelLines(text) : cleanOcrText(text);
}

/** 페이지 이미지 한 장을 읽어요: 표 칸을 찾으면 칸마다 확대해서, 못 찾으면 페이지 전체를 키워서 읽어요. */
async function recognizePage(worker: TesseractWorker, image: Blob): Promise<string> {
  const bitmap = await createImageBitmap(image);
  try {
    const page = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = page.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(bitmap, 0, 0);
    const regions = segmentTable(toGray(context.getImageData(0, 0, page.width, page.height)), page.width, page.height);

    if (!regions) {
      const scale = Math.min(FALLBACK_MAX_SCALE, Math.max(1, FALLBACK_TARGET_WIDTH / page.width));
      return cleanOcrText(await readCanvas(worker, scaledCanvas(page, 0, 0, page.width, page.height, scale), PSM.SINGLE_COLUMN));
    }
    const parts: string[] = [];
    for (const region of regions) {
      const text = await readRegion(worker, page, region);
      if (text) parts.push(region.kind === 'label' ? text : text + '\n');
    }
    return parts.join('\n');
  } finally {
    bitmap.close();
  }
}

self.onmessage = async ({ data }: MessageEvent<PageOcrRequest | { kind: 'dispose' }>) => {
  if ('kind' in data) {
    const current = engine;
    engine = undefined;
    currentMode = undefined;
    await (await current?.catch(() => undefined))?.terminate();
    self.postMessage({ kind: 'disposed' });
    return;
  }
  try {
    const worker = await getEngine();
    self.postMessage({ kind: 'page', id: data.id, text: await recognizePage(worker, data.image) });
  } catch {
    self.postMessage({ kind: 'error', id: data.id });
  }
};
