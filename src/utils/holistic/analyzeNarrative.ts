import { buildCitations } from './citations';
import { buildCoverage, buildEvidence, buildIndicatorSignals, buildInterestTags } from './buildPayload';
import { createModelClassifier, isModelCompatible } from './holisticModel';
import type { HolisticModel } from './holisticModel';
import { compileRules, findClauseHits } from './matchRules';
import { loadBundledModel } from './model';
import { BUNDLED_RULES } from './rules';
import { splitSections } from './splitSections';
import type { HolisticRules, NarrativeAnalysisResult, TagKeyword } from './types';

interface AnalyzeOptions {
  /** 서버에서 받아 온 규칙 사전. 없으면 앱에 포함된 사전을 쓴다. */
  rules?: HolisticRules;
  /** 전공 키워드 사전(GET /api/tag-map)의 entries. 없으면 관심 계열 태그를 비워서 보낸다. */
  tagKeywords?: readonly TagKeyword[];
  /**
   * 구절 분류 모델. 생략하거나 null 이면 규칙만 쓴다(앱에 포함된 모델은 analyzeNarrativeWithBundledModel 이 읽어 온다).
   * 모델이 규칙 사전 버전과 맞지 않으면 자동으로 규칙만 쓴다.
   */
  model?: HolisticModel | null;
}

/**
 * PDF·OCR로 읽은 전문을 기기 안에서 분석해 서버로 보낼 holisticAnalysis 값만 돌려준다.
 * 전문(fullText)은 이 함수 안에서만 쓰고 반환값·상태·저장소 어디에도 남기지 않는다.
 * 부수효과가 없는 순수 함수라 나중에 Web Worker로 옮기기 쉽다.
 */
export function analyzeNarrative(fullText: string, options: AnalyzeOptions = {}): NarrativeAnalysisResult {
  const rules = options.rules ?? BUNDLED_RULES;
  const blocks = splitSections(fullText);
  if (blocks.length === 0) return { ok: false, reason: 'no-sections' };

  const coverage = buildCoverage(blocks);
  const totalChars = Object.values(coverage.sectionChars).reduce((sum, chars) => sum + chars, 0);
  if (totalChars < rules.limits.minNarrativeChars) return { ok: false, reason: 'too-short' };

  const model = options.model ?? null;
  const classifier = model && isModelCompatible(model, rules.rulesVersion) ? createModelClassifier(model, rules.rules) : null;
  const compiled = compileRules(rules.rules);
  const hits = findClauseHits(blocks, compiled, classifier);
  return {
    ok: true,
    citations: buildCitations(blocks, compiled, classifier),
    payload: {
      rulesVersion: rules.rulesVersion,
      coverage,
      indicatorSignals: buildIndicatorSignals(hits, rules.limits),
      interestTags: buildInterestTags(blocks, options.tagKeywords ?? [], rules.limits),
      evidence: buildEvidence(hits, rules.limits),
    },
  };
}

/**
 * 앱에 포함된 모델을 읽어 와서 분석한다. 모델은 별도 파일이라 처음에는 읽는 시간이 든다.
 * 모델을 읽지 못하면(오프라인 등) 규칙만으로 분석한다. options.model 을 주면 그 값을 그대로 쓴다.
 */
export async function analyzeNarrativeWithBundledModel(
  fullText: string,
  options: AnalyzeOptions = {},
): Promise<NarrativeAnalysisResult> {
  if (options.model !== undefined) return analyzeNarrative(fullText, options);
  const model = await loadBundledModel().catch(() => null);
  return analyzeNarrative(fullText, { ...options, model });
}
