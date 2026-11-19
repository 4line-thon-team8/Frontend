import { charWbNgrams } from './holisticModel';

/**
 * 서술 한 덩어리의 "내용의 구체성"(0~3점)을 매기는 선형 회귀 모델. 앱에 번들해 두고 기기 안에서만 쓴다.
 * 학습·내보내기는 파이썬(quality-model-<버전>.json)에서 하며, 여기서는 같은 계산을 그대로 재현한다.
 * 입력: char_wb 1~3-gram TF-IDF(L2 정규화)만 쓴다. 글자 수 특성은 일부러 뺐다(길이로 점수를 올릴 수 있어서).
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
}

export const QUALITY_SCORE_MAX = 3;

export interface QualityScorer {
  /** 0~1. 모델 점수(0~3)를 0~1로 줄여서 돌려준다. */
  score: (text: string) => number;
}

export function createQualityScorer(model: QualityModel): QualityScorer {
  const [minN, maxN] = model.ngramRange;
  const vocabulary = new Map<string, number>(Object.entries(model.vocab));
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
      return Math.min(Math.max(z, 0), QUALITY_SCORE_MAX) / QUALITY_SCORE_MAX;
    },
  };
}
