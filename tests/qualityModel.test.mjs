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
  const quality = await server.ssrLoadModule('/src/utils/holistic/qualityModel.ts');
  const loader = await server.ssrLoadModule('/src/utils/holistic/qualityModelLoader.ts');
  const payload = await server.ssrLoadModule('/src/utils/holistic/buildPayload.ts');
  return { ...quality, ...payload, model: await loader.loadQualityModel() };
}

const FILLER = '성실하고 수업 태도가 바르며 친구들과 원만하게 지냄.';
const CONCRETE = '물의 표면장력 변화를 주제로 가설을 세우고 온도와 농도를 변인으로 통제하여 3회 반복 측정한 뒤 평균을 계산함.';
const ROLE_ONLY = '일본어 부장으로서 수업 전 준비물을 챙기거나 공지사항을 전달하는 등 책임감을 가지고 역할을 수행함.';

test('품질 모델: 성실·역할만 있는 문장은 낮고, 방법과 결과가 있는 문장은 높다', async t => {
  const { createQualityScorer, model } = await load(t);
  const scorer = createQualityScorer(model);
  const [filler, role, concrete] = [FILLER, ROLE_ONLY, CONCRETE].map(scorer.score);
  assert.ok(filler < 0.15, `성실 문장 ${filler}`);
  assert.ok(role < 0.6, `역할 문장 ${role}`);
  assert.ok(concrete > 0.6, `구체 문장 ${concrete}`);
  assert.ok(filler < role && role < concrete);
});

test('품질 모델 점수는 0~1 범위이고 빈 문자열도 던지지 않는다', async t => {
  const { createQualityScorer, model } = await load(t);
  const scorer = createQualityScorer(model);
  for (const text of ['', ' ', 'a', FILLER, CONCRETE.repeat(5)]) {
    const value = scorer.score(text);
    assert.ok(value >= 0 && value <= 1, `${text.slice(0, 10)} → ${value}`);
  }
});

test('entryQuality 는 scorer 가 있으면 모델 점수를, 없으면 규칙 값을 쓴다', async t => {
  const { createQualityScorer, entryQuality, model } = await load(t);
  const scorer = createQualityScorer(model);
  assert.equal(entryQuality(FILLER, scorer), scorer.score(FILLER));
  assert.equal(entryQuality(FILLER), entryQuality(FILLER, null));
});

test('품질 모델도 성실 문장을 길게 늘여도 점수가 오르지 않는다', async t => {
  const { createQualityScorer, entryQuality, model } = await load(t);
  const scorer = createQualityScorer(model);
  const long = Array.from({ length: 12 }, () => FILLER).join(' ');
  assert.ok(entryQuality(long, scorer) < 0.2);
});
