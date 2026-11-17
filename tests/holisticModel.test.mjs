import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

const golden = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'holistic-model-golden.json'), 'utf8'));

async function load(t) {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  t.after(() => server.close());
  const modelCore = await server.ssrLoadModule('/src/utils/holistic/holisticModel.ts');
  const model = await server.ssrLoadModule('/src/utils/holistic/model.ts');
  const rules = await server.ssrLoadModule('/src/utils/holistic/rules.ts');
  return { ...modelCore, ...model, ...rules };
}

test('char_wb n-gram 이 scikit-learn 과 같은 모양이다', async t => {
  const { charWbNgrams } = await load(t);
  assert.deepEqual(charWbNgrams('가나', 1, 2), [' ', '가', '나', ' ', ' 가', '가나', '나 ']);
  // 단어가 n 보다 짧으면 한 번만 센다
  assert.deepEqual(charWbNgrams('a', 3, 3), [' a ']);
  assert.deepEqual(charWbNgrams('  A   b ', 2, 2), [' a', 'a ', ' b', 'b ']);
});

test('번들 모델은 번들 규칙 사전 버전과 짝이 맞는다', async t => {
  const { BUNDLED_MODEL, BUNDLED_RULES, isModelCompatible } = await load(t);
  assert.equal(isModelCompatible(BUNDLED_MODEL, BUNDLED_RULES.rulesVersion), true);
  assert.equal(isModelCompatible(BUNDLED_MODEL, '0.0.1'), false);
});

test('파이썬 참조 구현과 같은 확률·적중을 낸다 (골든 케이스)', async t => {
  const { BUNDLED_MODEL, BUNDLED_RULES, createModelClassifier } = await load(t);
  const classifier = createModelClassifier(BUNDLED_MODEL, BUNDLED_RULES.rules);
  for (const sample of golden) {
    const result = classifier.predict(sample.section, sample.clause);
    for (const [id, expected] of Object.entries(sample.probs)) {
      const got = result.probabilities[id];
      assert.ok(Math.abs(got - expected) < 1e-4, `${id} ${got} != ${expected} | ${sample.clause}`);
    }
    assert.deepEqual([...result.indicators].sort(), [...sample.hits].sort(), sample.clause);
  }
});
