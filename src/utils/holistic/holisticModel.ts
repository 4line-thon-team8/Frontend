import { compileRules, matchRule } from './matchRules';
import type { CompiledRule } from './matchRules';
import type { HolisticRule, NarrativeSection } from './types';

/**
 * 구절 단위 지표 분류 모델(로지스틱 회귀). 서버 규칙 사전과 별개로 앱에 번들해 두고 기기 안에서만 쓴다.
 * 학습·내보내기는 파이썬(model-<버전>.json)에서 하며, 여기서는 같은 계산을 그대로 재현한다.
 * 입력: 구절의 char_wb 1~3-gram TF-IDF(L2 정규화) + 영역 원-핫 + 규칙 적중 플래그.
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

/** scikit-learn 의 analyzer='char_wb' 와 같은 n-gram. 단어마다 앞뒤에 공백을 붙여 단어 안에서만 자른다. */
export function charWbNgrams(text: string, minN: number, maxN: number): string[] {
  const grams: string[] = [];
  for (const word of text.toLowerCase().split(WHITESPACE)) {
    if (word === '') continue;
    const chars = Array.from(` ${word} `);
    const length = chars.length;
    for (let n = minN; n <= maxN; n++) {
      let offset = 0;
      grams.push(chars.slice(offset, offset + n).join(''));
      while (offset + n < length) {
        offset += 1;
        grams.push(chars.slice(offset, offset + n).join(''));
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
  const weights = new Map(
    indicatorIds.map(id => [id, new Map(Object.entries(model.indicators[id]!.coef).map(([index, w]) => [Number(index), w]))]),
  );

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
    return x;
  }

  return {
    modelVersion: model.modelVersion,
    predict(section, clause) {
      const x = features(section, clause);
      const probabilities: Record<string, number> = {};
      const hits: string[] = [];
      for (const id of indicatorIds) {
        const indicator = model.indicators[id]!;
        const w = weights.get(id)!;
        let z = indicator.intercept;
        for (const [index, value] of x) z += (w.get(index) ?? 0) * value;
        const p = sigmoid(z);
        probabilities[id] = p;
        if (p >= indicator.threshold) hits.push(id);
      }
      return { probabilities, indicators: hits };
    },
  };
}
