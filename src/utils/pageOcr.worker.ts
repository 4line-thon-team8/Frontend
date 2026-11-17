import { createWorker, OEM, PSM } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';

type PageOcrRequest = { id: number; image: Blob };

let engine: Promise<TesseractWorker> | undefined;

// 엔진(언어 데이터 포함)은 첫 페이지에서 한 번만 만들고 모든 페이지가 재사용해요.
function getEngine() {
  engine ??= (async () => {
    const created = await createWorker(['kor', 'eng'], OEM.LSTM_ONLY, { workerPath, workerBlobURL: false, cacheMethod: 'none' });
    await created.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    return created;
  })();
  return engine;
}

self.onmessage = async ({ data }: MessageEvent<PageOcrRequest | { kind: 'dispose' }>) => {
  if ('kind' in data) {
    const current = engine;
    engine = undefined;
    await (await current?.catch(() => undefined))?.terminate();
    self.postMessage({ kind: 'disposed' });
    return;
  }
  try {
    const worker = await getEngine();
    const bytes = new Uint8Array(await data.image.arrayBuffer());
    const { data: result } = await worker.recognize(bytes);
    self.postMessage({ kind: 'page', id: data.id, text: result.text });
  } catch {
    self.postMessage({ kind: 'error', id: data.id });
  }
};
