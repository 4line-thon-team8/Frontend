import { createWorker, OEM, PSM } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';

self.onmessage = async ({ data: file }: MessageEvent<File>) => {
  let engine: TesseractWorker | undefined;
  try {
    engine = await createWorker(['kor', 'eng'], OEM.LSTM_ONLY, {
      workerPath,
      workerBlobURL: false,
      cacheMethod: 'none',
      errorHandler: () => self.postMessage({ kind: 'error' }),
      logger: ({ status, progress }) => {
        if (status === 'recognizing text') {
          self.postMessage({ kind: 'recognizing', progress });
        }
      },
    });
    await engine.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    self.postMessage({ kind: 'recognizing', progress: 0 });
    const { data } = await engine.recognize(new Uint8Array(await file.arrayBuffer()));
    await engine.terminate();
    engine = undefined;
    self.postMessage({ kind: 'success', text: data.text.trim() });
  } catch {
    await engine?.terminate();
    self.postMessage({ kind: 'error' });
  }
};
