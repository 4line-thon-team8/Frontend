import { createWorker, OEM, PSM } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import { detectOcrTables, recognizeOcrTable } from './ocrTable';
import type { Cell } from './ocrTable';
import type { ConfirmSubject } from '../types/gradeConfirm';
import { flattenIllumination, toGray } from './ocr/flattenIllumination';

const MAX_PIXELS = 12_000_000;

/** 조명 불균형을 보정한 PNG 바이트를 만든다. 실패하거나 이미지가 너무 크면 null을 돌려주고 호출부가 원본을 쓴다. */
async function flattenedBytes(file: File): Promise<Uint8Array | null> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const { width, height } = bitmap;
      if (width * height > MAX_PIXELS) return null;
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      const flat = flattenIllumination(toGray(context.getImageData(0, 0, width, height).data, width, height));
      const output = context.createImageData(width, height);
      for (let index = 0; index < flat.data.length; index += 1) {
        const value = flat.data[index] ?? 255;
        output.data.set([value, value, value, 255], index * 4);
      }
      context.putImageData(output, 0, 0);
      return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

self.onmessage = async ({ data: file }: MessageEvent<File>) => {
  let engine: TesseractWorker | undefined;
  let fullImageReady = false;
  try {
    engine = await createWorker(['kor', 'eng'], OEM.LSTM_ONLY, {
      workerPath,
      workerBlobURL: false,
      cacheMethod: 'none',
      errorHandler: () => { if (!fullImageReady) self.postMessage({ kind: 'error' }); },
      logger: ({ status, progress }) => {
        if (status === 'recognizing text') {
          self.postMessage({ kind: 'recognizing', progress });
        }
      },
    });
    await engine.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    self.postMessage({ kind: 'recognizing', progress: 0 });
    // 인식은 조명 보정본으로, 표 영역 검출은 원본 픽셀로 한다.
    const bytes = (await flattenedBytes(file)) ?? new Uint8Array(await file.arrayBuffer());
    const { data } = await engine.recognize(bytes, {}, { text: true, blocks: true });
    const words = (data.blocks ?? []).flatMap(block => block.paragraphs.flatMap(paragraph =>
      paragraph.lines.flatMap(line => line.words.map(({ text, confidence, bbox }) => ({ text, confidence, bbox })))));
    fullImageReady = true;
    let tableSubjects: ConfirmSubject[] = [];
    try {
      const bitmap = await createImageBitmap(file);
      let tables: Cell[][][] = [];
      let layeredTables: Cell[][][] = [];
      try {
        const { width, height } = bitmap;
        if (width * height <= MAX_PIXELS) {
          const canvas = new OffscreenCanvas(width, height);
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) throw new Error('Canvas unavailable');
          context.drawImage(bitmap, 0, 0);
          const pixels = context.getImageData(0, 0, width, height).data;
          const dark = (threshold: number) => (x: number, y: number) => {
            const offset = (y * width + x) * 4;
            return pixels[offset + 3]! > 200 && pixels[offset]! + pixels[offset + 1]! + pixels[offset + 2]! < threshold;
          };
          tables = detectOcrTables(width, height, dark(270));
          layeredTables = detectOcrTables(width, height, dark(600), true);
        }
      } finally {
        bitmap.close();
      }
      if (tables.length || layeredTables.length) {
        const worker = engine;
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
        const read = async (rectangle: Cell) => (await worker.recognize(bytes, { rectangle })).data;
        tableSubjects = await recognizeOcrTable(tables, read);
        if (!tableSubjects.some(subject => subject.grade)) {
          const fallback = await recognizeOcrTable(layeredTables, read, true);
          if (fallback.length) tableSubjects = fallback;
        }
      }
    } catch {
      // The full-image result remains available when grid recognition is unsupported.
    }
    await engine.terminate();
    engine = undefined;
    self.postMessage({ kind: 'success', result: { text: data.text, words, tableSubjects } });
  } catch {
    await engine?.terminate();
    self.postMessage({ kind: 'error' });
  }
};
