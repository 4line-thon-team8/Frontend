type PageOcrMessage =
  | { kind: 'page'; id: number; text: string }
  | { kind: 'error'; id: number }
  | { kind: 'disposed' };

export interface PageOcr {
  /** 페이지 이미지 한 장의 글자를 읽어요. 읽지 못하면 reject돼요. */
  recognize(image: Blob): Promise<string>;
  dispose(): void;
}

const PAGE_TIMEOUT_MS = 120_000;

/** 스캔 PDF 페이지를 한 장씩 OCR하는 워커 한 개를 만들어요. 전체 작업은 signal로 중단할 수 있어요. */
export function createPageOcr(signal: AbortSignal): PageOcr {
  signal.throwIfAborted();
  const worker = new Worker(new URL('./pageOcr.worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<number, { resolve(text: string): void; reject(error: unknown): void; timer: number }>();
  let sequence = 0;

  function rejectAll(error: unknown) {
    for (const { reject, timer } of pending.values()) {
      window.clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  }

  function dispose() {
    signal.removeEventListener('abort', abort);
    rejectAll(signal.reason ?? new Error('Page OCR disposed'));
    worker.terminate();
  }

  function abort() {
    dispose();
  }

  worker.onmessage = ({ data }: MessageEvent<PageOcrMessage>) => {
    if (data.kind === 'disposed') return;
    const request = pending.get(data.id);
    if (!request) return;
    window.clearTimeout(request.timer);
    pending.delete(data.id);
    if (data.kind === 'page') request.resolve(data.text);
    else request.reject(new Error('Page OCR failed'));
  };
  worker.onerror = event => {
    event.preventDefault();
    rejectAll(new Error('Page OCR worker failed'));
  };
  signal.addEventListener('abort', abort, { once: true });

  return {
    recognize(image) {
      return new Promise<string>((resolve, reject) => {
        if (signal.aborted) return reject(signal.reason);
        const id = ++sequence;
        const timer = window.setTimeout(() => {
          pending.delete(id);
          reject(new Error('Page OCR timed out'));
        }, PAGE_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timer });
        worker.postMessage({ id, image });
      });
    },
    dispose,
  };
}
