import { splitSections } from './splitSections';
import type { NarrativeAnalysisResult, NarrativeBlock } from './types';

/**
 * 확인 단계 동안 서술(영역×학년 블록)과 그 분석 결과를 들고 있는 작은 상태 관리자.
 * React 와 무관하게 만들어서 단독으로 테스트하고, GradeAnalysisProvider 가 상태로 비춰 쓴다.
 *
 * 개인정보 규칙: 블록(서술 문장)은 이 객체의 메모리에만 있고 저장소·서버로 내보내지 않는다.
 * 분석 결과(result)에는 서술 전문이 없다(신호와 가린 구절만).
 */
export interface NarrativeSessionState {
  blocks: readonly NarrativeBlock[] | null;
  result: NarrativeAnalysisResult | null;
}

export interface NarrativeSession {
  /** 추출한 전문을 블록으로 나눠 담고 분석을 시작한다. 비었거나 null 이면 서술과 결과를 모두 비운다. */
  load(fullText: string | null): void;
  /** 블록을 고친다. delayMs 동안 더 고치지 않으면 고친 블록으로 다시 분석한다. 서술이 없으면 아무 일도 하지 않는다. */
  edit(update: (current: readonly NarrativeBlock[]) => readonly NarrativeBlock[]): void;
  /** 가장 최근 블록 기준 분석이 끝나길 기다려 결과를 돌려준다. 분석한 적이 없으면 null. */
  resolve(): Promise<NarrativeAnalysisResult | null>;
  /** 서술 문장(블록)만 지운다. 분석 결과는 남긴다. */
  discardText(): void;
  /** 서술과 결과를 모두 지우고 진행 중인 분석 결과도 무시한다. */
  reset(): void;
  /** 정리: 예약된 다시 분석을 취소한다. */
  dispose(): void;
  getState(): NarrativeSessionState;
}

export interface NarrativeSessionOptions {
  /** 블록을 분석한다. 던지면 결과 없음(null)으로 취급한다. */
  analyze: (blocks: readonly NarrativeBlock[]) => Promise<NarrativeAnalysisResult>;
  /** 상태가 바뀔 때마다 부른다. */
  onChange?: (state: NarrativeSessionState) => void;
  /** 고친 뒤 이 시간(ms) 가만히 있으면 다시 분석한다. 글자를 칠 때마다 분석하지 않으려는 값이다. */
  delayMs?: number;
}

const DEFAULT_DELAY_MS = 500;

export function createNarrativeSession(options: NarrativeSessionOptions): NarrativeSession {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  let state: NarrativeSessionState = { blocks: null, result: null };
  // 블록이 바뀌거나 비워질 때마다 올려, 늦게 끝난 옛 분석 결과가 최신 상태를 덮어쓰지 않게 한다.
  let run = 0;
  let latest: Promise<NarrativeAnalysisResult | null> = Promise.resolve(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function setState(next: NarrativeSessionState) {
    state = next;
    options.onChange?.(state);
  }

  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function analyzeNow(blocks: readonly NarrativeBlock[]): Promise<NarrativeAnalysisResult | null> {
    cancelTimer();
    const mine = (run += 1);
    latest = options.analyze(blocks).then(
      result => {
        if (mine === run) setState({ ...state, result });
        return result;
      },
      () => null,
    );
    return latest;
  }

  return {
    load(fullText) {
      cancelTimer();
      const blocks = fullText?.trim() ? splitSections(fullText) : null;
      if (!blocks) {
        run += 1;
        latest = Promise.resolve(null);
        setState({ blocks: null, result: null });
        return;
      }
      setState({ blocks, result: null });
      void analyzeNow(blocks);
    },
    edit(update) {
      if (!state.blocks) return;
      const blocks = update(state.blocks);
      cancelTimer();
      // 다시 분석이 끝나기 전에는 이전 결과가 쓰이지 않도록 지금 실행 번호를 올려 둔다.
      run += 1;
      setState({ ...state, blocks });
      timer = setTimeout(() => void analyzeNow(blocks), delayMs);
    },
    resolve() {
      // 아직 기다리는 중인 다시 분석이 있으면 지금 바로 시작한다.
      if (timer !== undefined && state.blocks) return analyzeNow(state.blocks);
      return latest;
    },
    discardText() {
      cancelTimer();
      setState({ ...state, blocks: null });
    },
    reset() {
      cancelTimer();
      run += 1;
      latest = Promise.resolve(null);
      setState({ blocks: null, result: null });
    },
    dispose: cancelTimer,
    getState: () => state,
  };
}
