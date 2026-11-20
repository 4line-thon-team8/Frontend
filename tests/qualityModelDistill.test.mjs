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
  return server.ssrLoadModule('/src/utils/holistic/qualityModel.ts');
}

// 계산을 손으로 검증할 수 있게 만든 아주 작은 가상 모델. 실제 학습 결과가 아니다.
function tiny(withDistill) {
  const model = {
    modelVersion: 'test',
    analyzer: 'char_wb',
    ngramRange: [1, 1],
    sublinearTf: false,
    intercept: 0.3,
    vocab: { 가: 0 },
    idf: [1],
    coef: [0.6],
  };
  if (withDistill) {
    model.distill = {
      ngramRange: [1, 1],
      sublinearTf: false,
      vocab: { 가: 0, 다: 1 },
      idf: [1, 1],
      coef: { 0: 0.9 },
    };
  }
  return model;
}

test('증류 항이 없으면 0.1.0 과 같은 계산이다', async t => {
  const { createQualityScorer } = await load(t);
  // x = {가: 1} → z = 0.3 + 0.6 = 0.9 → 0.9 / 3
  assert.ok(Math.abs(createQualityScorer(tiny(false)).score('가') - 0.9 / 3) < 1e-12);
});

test('증류 항은 별도 사전의 L2 정규화 TF-IDF 에 계수를 곱해 더한다', async t => {
  const { createQualityScorer } = await load(t);
  // 본 항 0.9, 증류 항: "가"와 "다"가 한 번씩 → 각 1/√2, "가"의 계수 0.9 → 0.9/√2
  const z = 0.9 + 0.9 / Math.sqrt(2);
  assert.ok(Math.abs(createQualityScorer(tiny(true)).score('가다') - Math.min(z, 3) / 3) < 1e-12);
});
