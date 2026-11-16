import { buildCoverage, buildEvidence, buildIndicatorSignals, buildInterestTags } from './buildPayload';
import { compileRules, findClauseHits } from './matchRules';
import { BUNDLED_RULES } from './rules';
import { splitSections } from './splitSections';
import type { HolisticRules, NarrativeAnalysisResult, TagKeyword } from './types';

interface AnalyzeOptions {
  /** 서버에서 받아 온 규칙 사전. 없으면 앱에 포함된 사전을 쓴다. */
  rules?: HolisticRules;
  /** 전공 키워드 사전(GET /api/tag-map)의 entries. 없으면 관심 계열 태그를 비워서 보낸다. */
  tagKeywords?: readonly TagKeyword[];
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

  const hits = findClauseHits(blocks, compileRules(rules.rules));
  return {
    ok: true,
    payload: {
      rulesVersion: rules.rulesVersion,
      coverage,
      indicatorSignals: buildIndicatorSignals(hits, rules.limits),
      interestTags: buildInterestTags(blocks, options.tagKeywords ?? [], rules.limits),
      evidence: buildEvidence(hits, rules.limits),
    },
  };
}
