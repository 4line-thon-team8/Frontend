import { buildCitations } from './citations';
import { buildCoverage, buildEvidence, buildIndicatorSignals, buildInterestTags } from './buildPayload';
import { createModelClassifier, isModelCompatible } from './holisticModel';
import type { HolisticModel, ModelClassifier } from './holisticModel';
import { compileRules, findClauseHits } from './matchRules';
import { loadBundledModel } from './modelLoader';
import { createQualityScorer } from './qualityModel';
import type { QualityModel, QualityScorer } from './qualityModel';
import { loadQualityModel } from './qualityModelLoader';
import { BUNDLED_RULES } from './rules';
import { splitSections } from './splitSections';
import type { HolisticRule, HolisticRules, NarrativeAnalysisResult, NarrativeBlock, TagKeyword } from './types';

/**
 * 같은 모델·규칙 조합의 분류기는 한 번만 만든다. 만드는 데 수십 ms 가 들고(가중치 표 구성),
 * 확인 화면에서 고친 뒤 다시 분석하는 흐름에서는 같은 조합으로 여러 번 부르기 때문이다.
 * 모델·규칙 객체가 더 쓰이지 않으면 함께 정리된다(WeakMap).
 */
const classifierCache = new WeakMap<HolisticModel, WeakMap<readonly HolisticRule[], ModelClassifier>>();

function classifierFor(model: HolisticModel, rules: readonly HolisticRule[]): ModelClassifier {
  let byRules = classifierCache.get(model);
  if (!byRules) {
    byRules = new WeakMap();
    classifierCache.set(model, byRules);
  }
  let classifier = byRules.get(rules);
  if (!classifier) {
    classifier = createModelClassifier(model, rules);
    byRules.set(rules, classifier);
  }
  return classifier;
}

export interface AnalyzeOptions {
  /** 서버에서 받아 온 규칙 사전. 없으면 앱에 포함된 사전을 쓴다. */
  rules?: HolisticRules;
  /** 전공 키워드 사전(GET /api/tag-map)의 entries. 없으면 관심 계열 태그를 비워서 보낸다. */
  tagKeywords?: readonly TagKeyword[];
  /**
   * 구절 분류 모델. 생략하거나 null 이면 규칙만 쓴다(앱에 포함된 모델은 analyzeNarrativeWithBundledModel 이 읽어 온다).
   * 모델이 규칙 사전 버전과 맞지 않으면 자동으로 규칙만 쓴다.
   */
  model?: HolisticModel | null;
  /** 서술 품질 모델. 생략하거나 null 이면 규칙 기반 품질을 쓴다(분석 함수 ...OnThisThread 가 앱에 포함된 모델을 읽어 온다). */
  qualityModel?: QualityModel | null;
}

const scorerCache = new WeakMap<QualityModel, QualityScorer>();

function scorerFor(model: QualityModel | null): QualityScorer | null {
  if (!model) return null;
  let scorer = scorerCache.get(model);
  if (!scorer) {
    scorer = createQualityScorer(model);
    scorerCache.set(model, scorer);
  }
  return scorer;
}

/**
 * PDF·OCR로 읽은 전문을 기기 안에서 분석해 서버로 보낼 holisticAnalysis 값만 돌려준다.
 * 전문(fullText)은 이 함수 안에서만 쓰고 반환값·상태·저장소 어디에도 남기지 않는다.
 * 부수효과가 없는 순수 함수라 나중에 Web Worker로 옮기기 쉽다.
 */
export function analyzeNarrative(fullText: string, options: AnalyzeOptions = {}): NarrativeAnalysisResult {
  return analyzeBlocks(splitSections(fullText), options);
}

/**
 * 영역×학년으로 이미 나눈 서술(splitSections 결과)을 분석한다. 확인 화면에서 서술을 고친 뒤 다시 분석할 때 쓴다.
 * analyzeNarrative(text) 는 splitSections(text) 뒤에 이 함수를 부르므로, 같은 블록이면 결과가 같다.
 */
export function analyzeBlocks(blocks: readonly NarrativeBlock[], options: AnalyzeOptions = {}): NarrativeAnalysisResult {
  const rules = options.rules ?? BUNDLED_RULES;
  if (blocks.length === 0) return { ok: false, reason: 'no-sections' };

  const coverage = buildCoverage(blocks);
  const totalChars = Object.values(coverage.sectionChars).reduce((sum, chars) => sum + chars, 0);
  if (totalChars < rules.limits.minNarrativeChars) return { ok: false, reason: 'too-short' };

  const model = options.model ?? null;
  const classifier = model && isModelCompatible(model, rules.rulesVersion) ? classifierFor(model, rules.rules) : null;
  const compiled = compileRules(rules.rules);
  const hits = findClauseHits(blocks, compiled, classifier);
  return {
    ok: true,
    citations: buildCitations(blocks, compiled, classifier),
    payload: {
      rulesVersion: rules.rulesVersion,
      coverage,
      indicatorSignals: buildIndicatorSignals(hits, rules.limits, scorerFor(options.qualityModel ?? null)),
      interestTags: buildInterestTags(blocks, options.tagKeywords ?? [], rules.limits),
      evidence: buildEvidence(hits, rules.limits),
    },
  };
}

/** 분류 모델과 품질 모델을 함께 읽는다. 하나라도 못 읽으면 그 모델만 빼고(null) 나머지로 분석한다. */
function loadModels(): Promise<[HolisticModel | null, QualityModel | null]> {
  return Promise.all([loadBundledModel().catch(() => null), loadQualityModel().catch(() => null)]);
}

/**
 * 이 스레드에서 앱에 포함된 모델을 읽어 와서 분석한다. 모델은 별도 파일이라 처음에는 읽는 시간이 든다.
 * 모델을 읽지 못하면(오프라인 등) 규칙만으로 분석한다. options.model 을 주면 그 값을 그대로 쓴다.
 * 워커 안에서도, 워커를 못 쓸 때의 대체 경로로도 이 함수를 쓴다(워커를 다시 부르지 않는다).
 */
export async function analyzeNarrativeOnThisThread(
  fullText: string,
  options: AnalyzeOptions = {},
): Promise<NarrativeAnalysisResult> {
  if (options.model !== undefined) return analyzeNarrative(fullText, options);
  const [model, qualityModel] = await loadModels();
  return analyzeNarrative(fullText, { ...options, model, qualityModel: options.qualityModel ?? qualityModel });
}

/** analyzeBlocks 의 모델 읽기 포함 버전. analyzeNarrativeOnThisThread 와 같은 규칙으로 모델을 정한다. */
export async function analyzeBlocksOnThisThread(
  blocks: readonly NarrativeBlock[],
  options: AnalyzeOptions = {},
): Promise<NarrativeAnalysisResult> {
  if (options.model !== undefined) return analyzeBlocks(blocks, options);
  const [model, qualityModel] = await loadModels();
  return analyzeBlocks(blocks, { ...options, model, qualityModel: options.qualityModel ?? qualityModel });
}
