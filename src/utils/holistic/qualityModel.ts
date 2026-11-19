import { charWbNgrams } from './holisticModel';

/**
 * 서술 한 덩어리의 "내용의 구체성"(0~3점)을 매기는 선형 회귀 모델. 앱에 번들해 두고 기기 안에서만 쓴다.
 * 학습·내보내기는 파이썬(quality-model-<버전>.json)에서 하며, 여기서는 같은 계산을 그대로 재현한다.
 * 입력: char_wb 1~3-gram TF-IDF(L2 정규화)만 쓴다. 글자 수 특성은 일부러 뺐다(길이로 점수를 올릴 수 있어서).
 * 0.2.0 부터는 증류 항이 더해진다. 비라벨 구절의 문장 임베딩을 글자 1~4-gram 에서 선형으로 흉내 낸 사상을 회귀 계수에 접어 넣은 것으로,
 * 별도 n-gram 사전의 TF-IDF(L2 정규화)에 계수를 곱해 더한다(절편은 intercept 에 합쳐 두었다).
 * 점수 기준: 주제·대상·방법·산출물·성찰이 문장 안에 실제로 있어야 높다. 성실·참여·역할만 있으면 낮다.
 */
export interface QualityModel {
  modelVersion: string;
  analyzer: 'char_wb';
  ngramRange: [number, number];
  sublinearTf: boolean;
  intercept: number;
  vocab: Record<string, number>;
  idf: number[];
  coef: number[];
  distill?: {
    ngramRange: [number, number];
    sublinearTf: boolean;
    vocab: Record<string, number>;
    idf: number[];
    /** 특성 번호 → 가중치. 0인 가중치는 뺐다. */
    coef: Record<string, number>;
  };
}

export const QUALITY_SCORE_MAX = 3;

export interface QualityScorer {
  /** 0~1. 모델 점수(0~3)를 0~1로 줄여서 돌려준다. */
  score: (text: string) => number;
}

export function createQualityScorer(model: QualityModel): QualityScorer {
  const [minN, maxN] = model.ngramRange;
  const vocabulary = new Map<string, number>(Object.entries(model.vocab));
  const distill = model.distill;
  const distillVocabulary = distill ? new Map<string, number>(Object.entries(distill.vocab)) : null;
  const distillCoef = distill ? new Map<number, number>(Object.entries(distill.coef).map(([k, v]) => [Number(k), v])) : null;

  /** 증류 항의 로짓. 정규화는 사전 전체로 하므로 가중치가 없는 n-gram 도 노름에 들어간다. */
  function distillLogit(text: string): number {
    if (!distill || !distillVocabulary || !distillCoef) return 0;
    const counts = new Map<number, number>();
    for (const gram of charWbNgrams(text, distill.ngramRange[0], distill.ngramRange[1])) {
      const index = distillVocabulary.get(gram);
      if (index !== undefined) counts.set(index, (counts.get(index) ?? 0) + 1);
    }
    const values = new Map<number, number>();
    let squares = 0;
    for (const [index, count] of counts) {
      const tf = distill.sublinearTf ? 1 + Math.log(count) : count;
      const value = tf * (distill.idf[index] ?? 0);
      values.set(index, value);
      squares += value * value;
    }
    const norm = Math.sqrt(squares) || 1;
    let z = 0;
    for (const [index, value] of values) z += (value / norm) * (distillCoef.get(index) ?? 0);
    return z;
  }

  return {
    score(text) {
      const counts = new Map<number, number>();
      for (const gram of charWbNgrams(text, minN, maxN)) {
        const index = vocabulary.get(gram);
        if (index !== undefined) counts.set(index, (counts.get(index) ?? 0) + 1);
      }
      const weights = new Map<number, number>();
      let squares = 0;
      for (const [index, count] of counts) {
        const tf = model.sublinearTf ? 1 + Math.log(count) : count;
        const value = tf * (model.idf[index] ?? 0);
        weights.set(index, value);
        squares += value * value;
      }
      const norm = Math.sqrt(squares) || 1;
      let z = model.intercept;
      for (const [index, value] of weights) z += (value / norm) * (model.coef[index] ?? 0);
      z += distillLogit(text);
      return Math.min(Math.max(z, 0), QUALITY_SCORE_MAX) / QUALITY_SCORE_MAX;
    },
  };
}
