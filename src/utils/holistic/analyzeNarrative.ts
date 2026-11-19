import { analyzeBlocks, analyzeBlocksOnThisThread, analyzeNarrative, analyzeNarrativeOnThisThread } from './analyzeNarrativeCore';
import type { AnalyzeOptions } from './analyzeNarrativeCore';
import { analyzeBlocksInWorker, analyzeInWorker } from './narrativeWorker';
import type { NarrativeAnalysisResult, NarrativeBlock } from './types';

export { analyzeBlocks, analyzeNarrative };
export type { AnalyzeOptions };

/**
 * 앱에 포함된 모델로 분석한다. 가능하면 Web Worker 에서 돌려 화면이 멈추지 않게 하고(저사양 폰에서는 분석이 수 초 걸릴 수 있다),
 * 워커를 못 쓰거나 실패하면 같은 계산을 이 스레드에서 한다. 결과는 어느 쪽이든 같다.
 * options.model 을 주면(null 포함) 그 값을 그대로 쓰므로 워커를 쓰지 않고 바로 계산한다.
 * 전문(fullText)은 워커로 복사돼 계산에만 쓰이고 워커에 남지 않는다.
 */
export async function analyzeNarrativeWithBundledModel(
  fullText: string,
  options: AnalyzeOptions = {},
): Promise<NarrativeAnalysisResult> {
  if (options.model !== undefined) return analyzeNarrative(fullText, options);
  try {
    return await analyzeInWorker(fullText, { rules: options.rules, tagKeywords: options.tagKeywords });
  } catch {
    return analyzeNarrativeOnThisThread(fullText, options);
  }
}

/**
 * analyzeNarrativeWithBundledModel 의 블록 버전. 확인 화면에서 서술을 고친 뒤 같은 방식(워커 우선, 실패 시 이 스레드)으로 다시 분석한다.
 */
export async function analyzeBlocksWithBundledModel(
  blocks: readonly NarrativeBlock[],
  options: AnalyzeOptions = {},
): Promise<NarrativeAnalysisResult> {
  if (options.model !== undefined) return analyzeBlocks(blocks, options);
  try {
    return await analyzeBlocksInWorker(blocks, { rules: options.rules, tagKeywords: options.tagKeywords });
  } catch {
    return analyzeBlocksOnThisThread(blocks, options);
  }
}
