export type ImageTextProgress = { kind: 'recognizing'; progress: number };

type ImageTextWorkerMessage = ImageTextProgress
  | { kind: 'success'; text: string }
  | { kind: 'error' };

export function extractImageText(
  file: File,
  signal: AbortSignal,
  onProgress: (progress: ImageTextProgress) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    // Own the worker from startup so cancellation also stops engine/model loading.
    const worker = new Worker(new URL('./imageText.worker.ts', import.meta.url), { type: 'module' });
    const timeout = window.setTimeout(fail, 120_000);

    function cleanup() {
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
    }

    function fail() {
      cleanup();
      reject(new Error('Image text extraction failed'));
    }

    function abort() {
      cleanup();
      reject(signal.reason);
    }

    worker.onmessage = ({ data }: MessageEvent<ImageTextWorkerMessage>) => {
      if (data.kind === 'recognizing') {
        onProgress(data);
      } else if (data.kind === 'success') {
        cleanup();
        resolve(data.text);
      } else {
        fail();
      }
    };
    worker.onerror = event => {
      event.preventDefault();
      fail();
    };
    worker.onmessageerror = fail;
    signal.addEventListener('abort', abort, { once: true });
    try {
      worker.postMessage(file);
    } catch {
      fail();
    }
  });
}
