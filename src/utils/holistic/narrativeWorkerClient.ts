import type { HolisticRules, NarrativeAnalysisResult, NarrativeBlock, TagKeyword } from './types';

/** 메인 스레드 → 워커. 전문(text)과 블록(blocks)은 계산에만 쓰이고 워커에 저장되지 않는다. */
export type NarrativeWorkerRequest =
  | { kind: 'analyze'; id: number; text: string; rules?: HolisticRules; tagKeywords?: readonly TagKeyword[] }
  | { kind: 'analyzeBlocks'; id: number; blocks: readonly NarrativeBlock[]; rules?: HolisticRules; tagKeywords?: readonly TagKeyword[] }
  | { kind: 'warm' };

/** 워커 → 메인 스레드. */
export type NarrativeWorkerResponse =
  | { kind: 'result'; id: number; result: NarrativeAnalysisResult }
  | { kind: 'failed'; id: number };

/** 실제 Worker 와 테스트용 가짜가 함께 만족하는 최소 모양. */
export interface NarrativeWorkerLike {
  postMessage(message: NarrativeWorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<NarrativeWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}

export interface NarrativeAnalyzeInput {
  rules?: HolisticRules | undefined;
  tagKeywords?: readonly TagKeyword[] | undefined;
}

export interface NarrativeWorkerClient {
  /** 워커에서 분석한다. 워커를 못 쓰거나 실패하면 reject 하므로, 부르는 쪽이 이 스레드 계산으로 대신한다. */
  analyze(text: string, input?: NarrativeAnalyzeInput): Promise<NarrativeAnalysisResult>;
  /** splitSections 로 이미 나눈 블록을 워커에서 분석한다. 실패 규칙은 analyze 와 같다. */
  analyzeBlocks(blocks: readonly NarrativeBlock[], input?: NarrativeAnalyzeInput): Promise<NarrativeAnalysisResult>;
  /** 워커를 미리 만들어 모델을 읽게 한다. 워커를 쓸 수 있으면 true. */
  warm(): boolean;
  /** 워커를 정리한다(대기 중인 요청은 reject). */
  dispose(): void;
}

export interface NarrativeWorkerClientOptions {
  /** 워커를 만든다. 쓸 수 없는 환경이면 null 을 돌려주거나 던진다. */
  createWorker: () => NarrativeWorkerLike | null;
  /** 응답이 이 시간 안에 안 오면 워커가 멈춘 것으로 보고 버린다. */
  timeoutMs?: number;
  /** 워커가 이 횟수만큼 실패하면 더 만들지 않고 이 스레드 계산만 쓴다. */
  maxFailures?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_FAILURES = 2;

interface Pending {
  resolve(result: NarrativeAnalysisResult): void;
  reject(error: unknown): void;
  timer: ReturnType<typeof setTimeout>;
}

export function createNarrativeWorkerClient(options: NarrativeWorkerClientOptions): NarrativeWorkerClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxFailures = options.maxFailures ?? DEFAULT_MAX_FAILURES;
  const pending = new Map<number, Pending>();
  let worker: NarrativeWorkerLike | null = null;
  let failures = 0;
  let sequence = 0;

  /** 워커를 버리고 기다리던 요청을 모두 실패시킨다. */
  function discard(reason: unknown) {
    const dropped = worker;
    worker = null;
    try {
      dropped?.terminate();
    } catch {
      // 이미 죽은 워커는 신경 쓰지 않는다.
    }
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(reason);
    }
    pending.clear();
  }

  function fail(source: NarrativeWorkerLike, reason: unknown) {
    if (worker !== source) return;
    failures += 1;
    discard(reason);
  }

  function ensureWorker(): NarrativeWorkerLike | null {
    if (worker) return worker;
    if (failures >= maxFailures) return null;
    let created: NarrativeWorkerLike | null = null;
    try {
      created = options.createWorker();
    } catch {
      created = null;
    }
    if (!created) {
      // Worker 를 지원하지 않는 환경이다. 다시 시도해도 같으니 더 만들지 않는다.
      failures = maxFailures;
      return null;
    }
    const source = created;
    source.onmessage = ({ data }) => {
      const request = pending.get(data.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(data.id);
      if (data.kind === 'result') request.resolve(data.result);
      else request.reject(new Error('Narrative analysis failed in worker'));
    };
    source.onerror = () => fail(source, new Error('Narrative worker error'));
    source.onmessageerror = () => fail(source, new Error('Narrative worker message error'));
    worker = source;
    return source;
  }

  function request(
    payload: { kind: 'analyze'; text: string } | { kind: 'analyzeBlocks'; blocks: readonly NarrativeBlock[] },
    input: NarrativeAnalyzeInput,
  ): Promise<NarrativeAnalysisResult> {
    const active = ensureWorker();
    if (!active) return Promise.reject(new Error('Narrative worker unavailable'));
    return new Promise<NarrativeAnalysisResult>((resolve, reject) => {
      const id = (sequence += 1);
      const timer = setTimeout(() => fail(active, new Error('Narrative worker timed out')), timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try {
        const message: NarrativeWorkerRequest = { ...payload, id };
        if (input.rules) message.rules = input.rules;
        if (input.tagKeywords) message.tagKeywords = input.tagKeywords;
        active.postMessage(message);
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }

  return {
    analyze: (text, input = {}) => request({ kind: 'analyze', text }, input),
    analyzeBlocks: (blocks, input = {}) => request({ kind: 'analyzeBlocks', blocks }, input),
    warm() {
      const active = ensureWorker();
      if (!active) return false;
      try {
        active.postMessage({ kind: 'warm' });
      } catch {
        return false;
      }
      return true;
    },
    dispose() {
      discard(new Error('Narrative worker disposed'));
    },
  };
}
