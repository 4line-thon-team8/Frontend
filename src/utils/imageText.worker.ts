import { createWorker, OEM, PSM } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import { detectOcrTables, recognizeOcrTable } from './ocrTable';
import type { Cell } from './ocrTable';
import type { ConfirmSubject } from '../types/gradeConfirm';

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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { data } = await engine.recognize(bytes, {}, { text: true, blocks: true });
    const words = (data.blocks ?? []).flatMap(block => block.paragraphs.flatMap(paragraph =>
      paragraph.lines.flatMap(line => line.words.map(({ text, confidence, bbox }) => ({ text, confidence, bbox })))));
    fullImageReady = true;
    let tableSubjects: ConfirmSubject[] = [];
    try {
      const bitmap = await createImageBitmap(file);
      let tables: Cell[][][] = [];
      try {
        const { width, height } = bitmap;
        if (width * height <= 12_000_000) {
          const canvas = new OffscreenCanvas(width, height);
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) throw new Error('Canvas unavailable');
          context.drawImage(bitmap, 0, 0);
          const pixels = context.getImageData(0, 0, width, height).data;
          tables = detectOcrTables(width, height, (x, y) => {
            const offset = (y * width + x) * 4;
            return pixels[offset + 3]! > 200 && pixels[offset]! + pixels[offset + 1]! + pixels[offset + 2]! < 270;
          });
        }
      } finally {
        bitmap.close();
      }
      if (tables.length) {
        const worker = engine;
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
        tableSubjects = await recognizeOcrTable(tables, async rectangle => (await worker.recognize(bytes, { rectangle })).data);
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
