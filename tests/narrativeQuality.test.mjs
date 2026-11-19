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
  return server.ssrLoadModule('/src/utils/holistic/buildPayload.ts');
}

// 네 탐구 단계(동기·과정·결과·성찰)가 서로 다른 문장에 하나씩만 들어 있고 숫자나 보고서 같은 구체 표현은 없다.
const STAGES = [
  '평소 학급 일에 궁금한 점이 많아 친구들에게 이야기를 자주 건네는 학생임.',
  '모둠에서 맡은 자료를 정리하고 발표 준비를 함께 진행함.',
  '그 덕분에 학급 분위기가 좋아지는 결과를 얻었다고 말함.',
  '다음에는 더 일찍 시작하겠다고 보완할 점을 이야기함.',
];

test('같은 내용이면 문단을 길게 이어 써도 품질이 크게 오르지 않는다', async t => {
  const { entryQuality } = await load(t);
  const filler = '평소 수업 시간에 성실하게 참여하고 주변 친구들과 원만하게 지내는 학생임.';
  // 탐구 단계 문장 하나가 중립 문장 네 개마다 한 번씩 나오는 긴 문단. 단계마다 서로 멀리 떨어져 있다.
  const parts = [];
  for (const stage of STAGES) {
    parts.push(stage, filler, filler, filler, filler);
  }
  const paragraph = parts.join(' ');
  const quality = entryQuality(paragraph);
  // 문단 전체를 한 번에 재면 네 단계가 모두 잡혀 0.5 가 된다. 덩어리로 재면 한 덩어리에 한두 단계뿐이라 훨씬 낮다.
  assert.ok(quality < 0.3, `quality=${quality}`);
});

test('짧은 문단은 그대로 한 덩어리로 잰다', async t => {
  const { entryQuality } = await load(t);
  assert.equal(entryQuality('보고서를 작성하며 결과를 확인함.'), 0.5 * (1 / 4) + 0.5);
  assert.equal(entryQuality('성실함.'), 0);
});

test('구체 표현과 탐구 단계가 모두 갖춰진 짧은 덩어리는 만점이다', async t => {
  const { entryQuality } = await load(t);
  assert.equal(entryQuality('궁금하여 3회 실험을 설계하고 결과를 확인한 뒤 한계를 보완함.'), 1);
});
