type PageOcrMessage =
  | { kind: 'page'; id: number; text: string }
  | { kind: 'error'; id: number }
  | { kind: 'disposed' };

export interface PageOcr {
  /** 페이지 이미지 한 장의 글자를 읽어요. 읽지 못하면 reject돼요. */
  recognize(image: Blob): Promise<string>;
  /** 동시에 읽을 수 있는 페이지 수예요(워커 수). */
  readonly concurrency: number;
  dispose(): void;
}

const PAGE_TIMEOUT_MS = 120_000;
// 워커 하나가 언어 데이터와 엔진으로 100MB 안팎을 쓰므로 많이 만들지 않아요.
const MAX_WORKERS = 3;

/** 기기 코어 수에 맞춰 워커 수를 정해요. 코어가 적은 기기는 1개로 안전하게 돌려요. */
function defaultWorkerCount(): number {
  const cores = typeof navigator === 'undefined' ? 1 : navigator.hardwareConcurrency || 1;
  return Math.max(1, Math.min(MAX_WORKERS, Math.floor(cores / 2)));
}

interface Pending { resolve(text: string): void; reject(error: unknown): void; timer: number }

/** 스캔 PDF 페이지를 OCR하는 워커 풀을 만들어요. 전체 작업은 signal로 중단할 수 있어요. */
export function createPageOcr(signal: AbortSignal, workerCount = defaultWorkerCount()): PageOcr {
  signal.throwIfAborted();
  const slots = Array.from({ length: workerCount }, () => ({
    worker: new Worker(new URL('./pageOcr.worker.ts', import.meta.url), { type: 'module' }),
    pending: new Map<number, Pending>(),
  }));
  let sequence = 0;

  function rejectAll(error: unknown) {
    for (const { pending } of slots) {
      for (const { reject, timer } of pending.values()) {
        window.clearTimeout(timer);
        reject(error);
      }
      pending.clear();
    }
  }

  function dispose() {
    signal.removeEventListener('abort', dispose);
    rejectAll(signal.reason ?? new Error('Page OCR disposed'));
    for (const { worker } of slots) worker.terminate();
  }

  for (const { worker, pending } of slots) {
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
  }
  signal.addEventListener('abort', dispose, { once: true });

  return {
    concurrency: workerCount,
    recognize(image) {
      return new Promise<string>((resolve, reject) => {
        if (signal.aborted) return reject(signal.reason);
        // 가장 한가한 워커에 맡겨요.
        const slot = slots.reduce((idle, candidate) => candidate.pending.size < idle.pending.size ? candidate : idle);
        const id = ++sequence;
        const timer = window.setTimeout(() => {
          slot.pending.delete(id);
          reject(new Error('Page OCR timed out'));
        }, PAGE_TIMEOUT_MS);
        slot.pending.set(id, { resolve, reject, timer });
        slot.worker.postMessage({ id, image });
      });
    },
    dispose,
  };
}
