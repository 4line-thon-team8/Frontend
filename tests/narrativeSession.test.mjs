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
  const session = await server.ssrLoadModule('/src/utils/holistic/narrativeSession.ts');
  const core = await server.ssrLoadModule('/src/utils/holistic/analyzeNarrativeCore.ts');
  const tags = await server.ssrLoadModule('/src/utils/holistic/tagKeywords.ts');
  return { ...session, ...core, ...tags };
}

// 실제 학생 기록이 아닌 가상의 서술이다. 분석 최소 분량을 넘도록 같은 문장을 몇 번 반복한다.
const BASE = `
동아리활동
1학년
파이썬으로 교내 설문 120명 자료를 분석하며 통계 처리를 익혔다. 분석 과정에서 표본 한계를 인식하고 보완했다.
진로활동
2학년
반도체 공정에 문제의식을 가지고 보고서를 작성했으며 3회 발표했다.
세부능력 및 특기사항
2학년
수학: 회귀분석을 활용해 성적과 학습 시간의 관계를 탐구했고 결과를 정리해 제출했다. 이후 더 깊은 심화 탐구로 나아갔다.
`;
const TEXT = BASE.repeat(4);
const wait = ms => new Promise(resolve => globalThis.setTimeout(resolve, ms));

/** 호출을 기록하고, 결과를 직접 내보낼 수 있는 가짜 분석기. */
function fakeAnalyzer() {
  const calls = [];
  const analyze = blocks => new Promise((resolve, reject) => {
    calls.push({ blocks, resolve, reject });
  });
  return { calls, analyze };
}

test('불러오면 블록으로 나눠 담고 분석하며, 비었거나 null 이면 모두 비운다', async t => {
  const m = await load(t);
  const fake = fakeAnalyzer();
  const session = m.createNarrativeSession({ analyze: fake.analyze, delayMs: 5 });
  t.after(() => session.dispose());
  session.load(TEXT);
  assert.ok(session.getState().blocks.length > 0);
  assert.equal(fake.calls.length, 1);
  const done = session.resolve();
  fake.calls[0].resolve({ ok: false, reason: 'too-short' });
  assert.deepEqual(await done, { ok: false, reason: 'too-short' });
  assert.deepEqual(session.getState().result, { ok: false, reason: 'too-short' });

  session.load('   ');
  assert.deepEqual(session.getState(), { blocks: null, result: null });
  assert.equal(fake.calls.length, 1);
  assert.equal(await session.resolve(), null);
});

test('연달아 고쳐도 마지막 블록으로 한 번만 다시 분석한다', async t => {
  const m = await load(t);
  const fake = fakeAnalyzer();
  const session = m.createNarrativeSession({ analyze: fake.analyze, delayMs: 20 });
  t.after(() => session.dispose());
  session.load(TEXT);
  fake.calls[0].resolve({ ok: false, reason: 'too-short' });
  await session.resolve();

  session.edit(blocks => blocks.map(block => ({ ...block, entries: [] })));
  session.edit(blocks => blocks.slice(0, 1));
  assert.equal(session.getState().blocks.length, 1);
  assert.equal(fake.calls.length, 1);
  await wait(60);
  assert.equal(fake.calls.length, 2);
  assert.equal(fake.calls[1].blocks.length, 1);
});

test('제출 시점에 다시 분석이 예약돼 있으면 기다리지 않고 바로 시작해 최신 결과를 준다', async t => {
  const m = await load(t);
  const fake = fakeAnalyzer();
  const session = m.createNarrativeSession({ analyze: fake.analyze, delayMs: 10_000 });
  t.after(() => session.dispose());
  session.load(TEXT);
  fake.calls[0].resolve({ ok: false, reason: 'too-short' });
  await session.resolve();

  session.edit(blocks => blocks.slice(0, 1));
  const pending = session.resolve();
  assert.equal(fake.calls.length, 2);
  fake.calls[1].resolve({ ok: false, reason: 'no-sections' });
  assert.deepEqual(await pending, { ok: false, reason: 'no-sections' });
  assert.deepEqual(session.getState().result, { ok: false, reason: 'no-sections' });
});

test('늦게 끝난 옛 분석 결과는 최신 결과를 덮어쓰지 않는다', async t => {
  const m = await load(t);
  const fake = fakeAnalyzer();
  const session = m.createNarrativeSession({ analyze: fake.analyze, delayMs: 5 });
  t.after(() => session.dispose());
  session.load(TEXT);
  session.edit(blocks => blocks.slice(0, 1));
  await wait(30);
  assert.equal(fake.calls.length, 2);
  fake.calls[1].resolve({ ok: false, reason: 'no-sections' });
  await wait(0);
  fake.calls[0].resolve({ ok: false, reason: 'too-short' });
  await wait(0);
  assert.deepEqual(session.getState().result, { ok: false, reason: 'no-sections' });
});

test('분석이 던져도 제출을 막지 않고 결과 없음으로 마무리한다', async t => {
  const m = await load(t);
  const fake = fakeAnalyzer();
  const session = m.createNarrativeSession({ analyze: fake.analyze });
  t.after(() => session.dispose());
  session.load(TEXT);
  const pending = session.resolve();
  fake.calls[0].reject(new Error('boom'));
  assert.equal(await pending, null);
  assert.equal(session.getState().result, null);
});

test('서술 문장만 지우면 결과는 남고, 초기화하면 진행 중인 분석 결과도 무시한다', async t => {
  const m = await load(t);
  const fake = fakeAnalyzer();
  const session = m.createNarrativeSession({ analyze: fake.analyze });
  t.after(() => session.dispose());
  session.load(TEXT);
  fake.calls[0].resolve({ ok: false, reason: 'too-short' });
  await session.resolve();
  session.discardText();
  assert.deepEqual(session.getState(), { blocks: null, result: { ok: false, reason: 'too-short' } });
  session.edit(blocks => blocks);
  assert.equal(session.getState().blocks, null);

  session.load(TEXT);
  session.reset();
  fake.calls[1].resolve({ ok: false, reason: 'no-sections' });
  await wait(0);
  assert.deepEqual(session.getState(), { blocks: null, result: null });
});

test('실제 분석기와 연결해도 결과에 서술 전문이 남지 않고, 고친 내용이 결과에 반영된다', async t => {
  const m = await load(t);
  const session = m.createNarrativeSession({
    analyze: async blocks => m.analyzeBlocks(blocks, { tagKeywords: [{ keyword: '반도체', tag: '반도체' }] }),
    delayMs: 5,
  });
  t.after(() => session.dispose());
  session.load(TEXT);
  const first = await session.resolve();
  // 근거 구절은 30자 이하의 짧은 조각만 나가므로, 그보다 긴 문장은 그대로 나가지 않아야 한다.
  assert.equal(first.ok, true);
  assert.deepEqual(first.payload.interestTags.map(tag => tag.tag), ['반도체']);
  assert.equal(JSON.stringify(first.payload).includes('성적과 학습 시간의 관계를 탐구했고 결과를 정리해 제출했다'), false);

  session.edit(blocks => blocks.map(block => ({
    ...block,
    entries: block.entries.map(entry => entry.replaceAll('반도체', '')),
  })));
  const edited = await session.resolve();
  assert.equal(edited.ok, true);
  assert.deepEqual(edited.payload.interestTags, []);
});

test('전공 키워드 사전은 한 번만 받고, 실패하면 빈 배열로 계속하며 다음에 다시 시도한다', async t => {
  const m = await load(t);
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('offline');
    return new globalThis.Response(JSON.stringify({ version: '1', entries: [{ keyword: '반도체', tag: '반도체' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  assert.deepEqual(await m.loadTagKeywords(), []);
  assert.deepEqual(await m.loadTagKeywords(), [{ keyword: '반도체', tag: '반도체' }]);
  await m.loadTagKeywords();
  assert.equal(calls, 2);
});
