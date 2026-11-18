import { compileRules, matchRule } from './matchRules';
import type { CompiledRule } from './matchRules';
import type { HolisticRule, NarrativeSection } from './types';

/**
 * 구절 단위 지표 분류 모델(로지스틱 회귀). 서버 규칙 사전과 별개로 앱에 번들해 두고 기기 안에서만 쓴다.
 * 학습·내보내기는 파이썬(model-<버전>.json)에서 하며, 여기서는 같은 계산을 그대로 재현한다.
 * 입력: 구절의 char_wb 1~3-gram TF-IDF(L2 정규화) + 영역 원-핫 + 규칙 적중 플래그 + 구절 길이 + 부정·개선 표현 유무.
 * 모델 0.5.0 부터는 NB-SVM 방식으로 학습했지만, 클래스별 비율 가중치를 계수에 미리 곱해 내보내므로 계산식은 그대로 선형이다.
 */

export interface HolisticModelIndicator {
  intercept: number;
  /** 이 값 이상이면 해당 지표에 적중으로 본다 */
  threshold: number;
  /** 특성 번호 → 가중치. 0인 가중치는 파일에서 뺐다. */
  coef: Record<string, number>;
}

export interface HolisticModel {
  modelVersion: string;
  /** 학습할 때 입력 특성으로 쓴 규칙 사전 버전. 규칙이 바뀌면 모델도 다시 학습해야 한다. */
  rulesVersion: string;
  analyzer: 'char_wb';
  ngramRange: [number, number];
  sublinearTf: boolean;
  /** 영역 원-핫 특성의 순서 */
  sections: NarrativeSection[];
  /** 규칙 적중 플래그 특성의 지표 순서 */
  ruleFlagOrder: string[];
  ruleFlagScale: number;
  /** 구절 길이 특성(0.5.0~). 두 개: min(글자 수, cap)/cap, 글자 수가 long 보다 크면 1. 둘 다 scale 을 곱한다. */
  lengthFeatures?: { cap: number; long: number; scale: number };
  /** 부정·개선 표현 특성(0.5.0~). 구절에 해당 문자열이 들어 있으면 해당 순서의 특성이 negationScale 이 된다. */
  negationTerms?: string[];
  negationScale?: number;
  vocab: Record<string, number>;
  idf: number[];
  indicators: Record<string, HolisticModelIndicator>;
}

export interface ModelPrediction {
  /** 지표별 확률(0~1) */
  probabilities: Record<string, number>;
  /** 임계값을 넘은 지표 */
  indicators: string[];
}

export interface ModelClassifier {
  modelVersion: string;
  predict: (section: NarrativeSection, clause: string) => ModelPrediction;
}

const WHITESPACE = /\s+/u;

const SURROGATE = /[\ud800-\udfff]/; // u 플래그를 쓰면 쌍을 한 글자로 봐서 감지하지 못한다

/** scikit-learn 의 analyzer='char_wb' 와 같은 n-gram. 단어마다 앞뒤에 공백을 붙여 단어 안에서만 자른다. */
export function charWbNgrams(text: string, minN: number, maxN: number): string[] {
  const grams: string[] = [];
  for (const word of text.toLowerCase().split(WHITESPACE)) {
    if (word === '') continue;
    const padded = ` ${word} `;
    // 한글·영문처럼 글자 하나가 UTF-16 한 칸이면 문자열을 바로 잘라도 코드포인트 단위와 같다(훨씬 빠르다).
    // 이모지 같은 서로게이트 쌍이 있으면 코드포인트 배열로 잘라 파이썬과 같은 결과를 지킨다.
    const chars = SURROGATE.test(padded) ? Array.from(padded) : null;
    const length = chars ? chars.length : padded.length;
    const cut = chars
      ? (from: number, to: number) => chars.slice(from, to).join('')
      : (from: number, to: number) => padded.slice(from, to);
    for (let n = minN; n <= maxN; n++) {
      let offset = 0;
      grams.push(cut(offset, offset + n));
      while (offset + n < length) {
        offset += 1;
        grams.push(cut(offset, offset + n));
      }
      // 단어가 n 보다 짧으면 한 번만 센다(scikit-learn 과 같은 동작).
      if (offset === 0) break;
    }
  }
  return grams;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** 규칙 사전이 모델을 학습할 때 쓴 버전과 같은지. 다르면 규칙 적중 플래그의 뜻이 달라져 모델을 쓰지 않는다. */
export function isModelCompatible(model: HolisticModel, rulesVersion: string): boolean {
  return model.rulesVersion === rulesVersion;
}

export function createModelClassifier(model: HolisticModel, rules: readonly HolisticRule[]): ModelClassifier {
  const compiled: CompiledRule[] = compileRules(rules);
  const [minN, maxN] = model.ngramRange;
  const vocabulary = new Map<string, number>(Object.entries(model.vocab));
  const sectionBase = model.idf.length;
  const flagBase = sectionBase + model.sections.length;
  const indicatorIds = Object.keys(model.indicators);
  // 특성 하나가 모든 지표에 주는 가중치를 한 칸 묶음으로 둔다(지표 수 K). 특성마다 Map 을 지표 수만큼 찾지 않고 한 번에 읽는다.
  // 지표마다 특성을 더하는 순서는 예전(지표별 Map 순회)과 같아서 계산 결과가 비트 단위로 같다.
  const indicatorCount = indicatorIds.length;
  const intercepts = Float64Array.from(indicatorIds, id => model.indicators[id]!.intercept);
  const thresholds = indicatorIds.map(id => model.indicators[id]!.threshold);
  let maxFeature = -1;
  for (const id of indicatorIds) {
    for (const index of Object.keys(model.indicators[id]!.coef)) maxFeature = Math.max(maxFeature, Number(index));
  }
  const dense = new Float64Array((maxFeature + 1) * indicatorCount);
  indicatorIds.forEach((id, k) => {
    for (const [index, w] of Object.entries(model.indicators[id]!.coef)) dense[Number(index) * indicatorCount + k] = w;
  });

  function ruleIndicators(section: NarrativeSection, clause: string): Set<string> {
    const found = new Set<string>();
    for (const item of compiled) {
      if (found.has(item.rule.indicator) || !item.rule.sections.includes(section)) continue;
      if (matchRule(item, clause)) found.add(item.rule.indicator);
    }
    return found;
  }

  function features(section: NarrativeSection, clause: string): Map<number, number> {
    const counts = new Map<number, number>();
    for (const gram of charWbNgrams(clause, minN, maxN)) {
      const index = vocabulary.get(gram);
      if (index !== undefined) counts.set(index, (counts.get(index) ?? 0) + 1);
    }
    const x = new Map<number, number>();
    let squares = 0;
    for (const [index, count] of counts) {
      const tf = model.sublinearTf ? 1 + Math.log(count) : count;
      const value = tf * (model.idf[index] ?? 0);
      x.set(index, value);
      squares += value * value;
    }
    const norm = Math.sqrt(squares) || 1;
    for (const [index, value] of x) x.set(index, value / norm);

    const sectionIndex = model.sections.indexOf(section);
    if (sectionIndex >= 0) x.set(sectionBase + sectionIndex, 1);
    const flags = ruleIndicators(section, clause);
    model.ruleFlagOrder.forEach((id, order) => {
      if (flags.has(id)) x.set(flagBase + order, model.ruleFlagScale);
    });
    // 학습 때와 같은 순서: 영역 → 규칙 플래그 → 길이(2) → 부정 표현.
    const lengthBase = flagBase + model.ruleFlagOrder.length;
    const negationBase = lengthBase + (model.lengthFeatures ? 2 : 0);
    if (model.lengthFeatures) {
      const { cap, long, scale } = model.lengthFeatures;
      const length = Array.from(clause).length; // 파이썬 len() 과 같이 코드포인트 수
      x.set(lengthBase, (Math.min(length, cap) / cap) * scale);
      if (length > long) x.set(lengthBase + 1, scale);
    }
    model.negationTerms?.forEach((term, order) => {
      if (clause.includes(term)) x.set(negationBase + order, model.negationScale ?? 1);
    });
    return x;
  }

  return {
    modelVersion: model.modelVersion,
    predict(section, clause) {
      const x = features(section, clause);
      const z = Float64Array.from(intercepts);
      for (const [index, value] of x) {
        if (index > maxFeature) continue; // 가중치가 없는 특성은 0 이다.
        const base = index * indicatorCount;
        for (let k = 0; k < indicatorCount; k++) z[k]! += dense[base + k]! * value;
      }
      const probabilities: Record<string, number> = {};
      const hits: string[] = [];
      for (let k = 0; k < indicatorCount; k++) {
        const id = indicatorIds[k]!;
        const p = sigmoid(z[k]!);
        probabilities[id] = p;
        if (p >= thresholds[k]!) hits.push(id);
      }
      return { probabilities, indicators: hits };
    },
  };
}
