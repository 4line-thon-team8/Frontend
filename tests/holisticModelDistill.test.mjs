import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

async function load(t) {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  t.after(() => server.close());
  return server.ssrLoadModule('/src/utils/holistic/holisticModel.ts');
}

// 계산을 손으로 검증할 수 있게 만든 아주 작은 가상 모델. 실제 학습 결과가 아니다.
function tinyModel(withDistill) {
  const model = {
    modelVersion: 'test',
    rulesVersion: '0.7.0',
    analyzer: 'char_wb',
    ngramRange: [1, 1],
    sublinearTf: false,
    sections: ['subject'],
    ruleFlagOrder: ['A3'],
    ruleFlagScale: 2,
    vocab: { 가: 0, 나: 1 },
    idf: [1, 1],
    indicators: { A3: { intercept: -0.5, threshold: 0.5, coef: { 0: 2 } } },
  };
  if (withDistill) {
    model.distill = {
      ngramRange: [1, 2],
      sublinearTf: false,
      // 사전 전체로 정규화한다: "가"(1) 와 "다"(1) 가 있고 "다"는 계수가 없어도 노름에 들어간다.
      vocab: { 가: 0, 다: 1 },
      idf: [1, 1],
      indicators: { A3: { coef: { 0: 3 } } },
    };
  }
  return model;
}

test('증류 항이 없으면 0.5.0 과 같은 계산이다', async t => {
  const { createModelClassifier } = await load(t);
  const p = createModelClassifier(tinyModel(false), []).predict('subject', '가').probabilities.A3;
  // x = {가: 1}, z = -0.5 + 2*1
  assert.ok(Math.abs(p - 1 / (1 + Math.exp(-1.5))) < 1e-12);
});

test('증류 항은 별도 사전의 L2 정규화 TF-IDF 에 계수를 곱해 로짓에 더한다', async t => {
  const { createModelClassifier } = await load(t);
  const classifier = createModelClassifier(tinyModel(true), []);
  // 본 항: 위와 같이 1.5. 증류 항: "가"와 "다" 가 한 번씩 → 각 1/sqrt(2), 계수는 "가"만 3.
  const z = 1.5 + 3 / Math.sqrt(2);
  const p = classifier.predict('subject', '가다').probabilities.A3;
  // "가다" 에서 본 항의 x 는 {가: 1/√1} 이 아니라 사전 {가,나} 중 "가"만 → 정규화 후 1 (나는 없음)
  assert.ok(Math.abs(p - 1 / (1 + Math.exp(-z))) < 1e-12);
});

test('증류 사전에 하나도 없는 구절은 증류 항이 0 이다', async t => {
  const { createModelClassifier } = await load(t);
  const base = createModelClassifier(tinyModel(false), []).predict('subject', '나').probabilities.A3;
  const withDistill = createModelClassifier(tinyModel(true), []).predict('subject', '나').probabilities.A3;
  assert.equal(withDistill, base);
});
