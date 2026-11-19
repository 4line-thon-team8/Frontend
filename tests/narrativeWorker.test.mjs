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
  const core = await server.ssrLoadModule('/src/utils/holistic/analyzeNarrativeCore.ts');
  const entry = await server.ssrLoadModule('/src/utils/holistic/analyzeNarrative.ts');
  const client = await server.ssrLoadModule('/src/utils/holistic/narrativeWorkerClient.ts');
  const model = await server.ssrLoadModule('/src/utils/holistic/model.ts');
  const holisticModel = await server.ssrLoadModule('/src/utils/holistic/holisticModel.ts');
  const sections = await server.ssrLoadModule('/src/utils/holistic/splitSections.ts');
  return { ...core, ...entry, ...client, ...model, ...holisticModel, ...sections };
}

// 실제 학생 기록이 아닌 가상의 서술이다. 분석 최소 분량을 넘도록 같은 문장을 몇 번 반복한다.
const BASE = `
동아리활동
1학년
파이썬으로 교내 설문 120명 자료를 분석하며 통계 처리를 익혔다. 분석 과정에서 표본 한계를 인식하고 보완했다.
2학년
알고리즘 동아리에서 크롤링 코드를 구현했고, 데이터를 수집하는 과정에서 궁금증이 생겨 후속 탐구를 이어 갔다. 컴퓨터 구조 책을 읽었다.
진로활동
2학년
반도체 공정에 문제의식을 가지고 보고서를 작성했으며 3회 발표했다.
세부능력 및 특기사항
2학년
수학: 회귀분석을 활용해 성적과 학습 시간의 관계를 탐구했고 결과를 정리해 제출했다. 이후 더 깊은 심화 탐구로 나아갔다.
`;
const TEXT = BASE.repeat(4);

/**
 * 진짜 Worker 처럼 동작하는 가짜. 메시지를 구조화 복제(structuredClone)로 주고받아서
 * 워커 경계를 지나도 결과가 그대로인지 함께 확인한다.
 */
function fakeWorker(handler, log = {}) {
  const worker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    terminated: false,
    postMessage(message) {
      log.messages?.push(message);
      const copy = globalThis.structuredClone(message);
      globalThis.queueMicrotask(async () => {
        const reply = await handler(copy, worker);
        if (reply && !worker.terminated) worker.onmessage?.({ data: globalThis.structuredClone(reply) });
      });
    },
    terminate() {
      worker.terminated = true;
      log.terminated = (log.terminated ?? 0) + 1;
    },
  };
  return worker;
}

const inProcessHandler = core => async message => {
  if (message.kind === 'warm') return null;
  try {
    // 실제 워커(narrativeAnalysis.worker.ts)처럼 규칙 사전·전공 키워드를 그대로 넘긴다.
    const options = {
      ...(message.rules ? { rules: message.rules } : {}),
      ...(message.tagKeywords ? { tagKeywords: message.tagKeywords } : {}),
    };
    const result = message.kind === 'analyzeBlocks'
      ? await core.analyzeBlocksOnThisThread(message.blocks, options)
      : await core.analyzeNarrativeOnThisThread(message.text, options);
    return { kind: 'result', id: message.id, result };
  } catch {
    return { kind: 'failed', id: message.id };
  }
};

test('워커를 거쳐도 결과가 이 스레드에서 계산한 결과와 같다', async t => {
  const m = await load(t);
  const client = m.createNarrativeWorkerClient({ createWorker: () => fakeWorker(inProcessHandler(m)) });
  t.after(() => client.dispose());
  const viaWorker = await client.analyze(TEXT);
  const direct = await m.analyzeNarrativeOnThisThread(TEXT);
  assert.equal(direct.ok, true);
  assert.deepEqual(viaWorker, direct);
});

test('워커를 쓸 수 없으면 reject 하고 다시 만들려 하지 않는다', async t => {
  const m = await load(t);
  let created = 0;
  const client = m.createNarrativeWorkerClient({ createWorker: () => { created += 1; return null; } });
  await assert.rejects(client.analyze(TEXT));
  await assert.rejects(client.analyze(TEXT));
  assert.equal(created, 1);
  assert.equal(client.warm(), false);
});

test('Worker 가 없는 환경(Node)에서도 번들 모델 분석은 같은 결과를 낸다', async t => {
  const m = await load(t);
  const bundled = await m.loadBundledModel();
  const quality = await m.loadQualityModel();
  const expected = m.analyzeNarrative(TEXT, { model: bundled, qualityModel: quality });
  assert.deepEqual(await m.analyzeNarrativeWithBundledModel(TEXT), expected);
});

test('워커가 오류를 내면 기다리던 요청이 실패하고, 실패가 반복되면 더 만들지 않는다', async t => {
  const m = await load(t);
  let created = 0;
  const log = {};
  const client = m.createNarrativeWorkerClient({
    maxFailures: 2,
    createWorker: () => {
      created += 1;
      const worker = fakeWorker(() => null, log);
      globalThis.queueMicrotask(() => globalThis.queueMicrotask(() => worker.onerror?.({})));
      return worker;
    },
  });
  await assert.rejects(client.analyze(TEXT), /worker error/i);
  await assert.rejects(client.analyze(TEXT), /worker error/i);
  await assert.rejects(client.analyze(TEXT), /unavailable/i);
  assert.equal(created, 2);
  assert.equal(log.terminated, 2);
});

test('응답이 없으면 시간 초과로 실패시키고 워커를 정리한다', async t => {
  const m = await load(t);
  const log = {};
  const client = m.createNarrativeWorkerClient({ timeoutMs: 30, createWorker: () => fakeWorker(() => null, log) });
  await assert.rejects(client.analyze(TEXT), /timed out/i);
  assert.equal(log.terminated, 1);
});

test('분석이 워커 안에서 실패해도 워커는 계속 쓸 수 있다', async t => {
  const m = await load(t);
  let calls = 0;
  const log = {};
  const client = m.createNarrativeWorkerClient({
    createWorker: () => fakeWorker(async message => {
      calls += 1;
      if (calls === 1) return { kind: 'failed', id: message.id };
      return inProcessHandler(m)(message);
    }, log),
  });
  t.after(() => client.dispose());
  await assert.rejects(client.analyze(TEXT), /failed in worker/i);
  assert.equal((await client.analyze(TEXT)).ok, true);
  assert.equal(log.terminated, undefined);
});

test('규칙 사전과 전공 키워드를 워커로 넘긴다', async t => {
  const m = await load(t);
  const log = { messages: [] };
  const client = m.createNarrativeWorkerClient({ createWorker: () => fakeWorker(inProcessHandler(m), log) });
  t.after(() => client.dispose());
  const tagKeywords = [{ keyword: '알고리즘', tag: '컴퓨터' }];
  await client.analyze(TEXT, { tagKeywords });
  assert.deepEqual(log.messages[0].tagKeywords, tagKeywords);
  assert.equal('rules' in log.messages[0], false);
});

test('warm 은 워커를 만들어 준비 메시지를 보낸다', async t => {
  const m = await load(t);
  const log = { messages: [] };
  const client = m.createNarrativeWorkerClient({ createWorker: () => fakeWorker(() => null, log) });
  t.after(() => client.dispose());
  assert.equal(client.warm(), true);
  assert.deepEqual(log.messages, [{ kind: 'warm' }]);
});

test('preloadBundledModel 은 Worker 가 없는 환경에서도 던지지 않는다', async t => {
  const m = await load(t);
  assert.doesNotThrow(() => m.preloadBundledModel());
});

test('char_wb n-gram 은 이모지가 있어도 코드포인트 단위로 자른다(파이썬 동작과 같다)', async t => {
  const m = await load(t);
  // 예전 구현(코드포인트 배열로 자르기)을 그대로 적은 기준 구현이다.
  const reference = (text, minN, maxN) => {
    const grams = [];
    for (const word of text.toLowerCase().split(/\s+/u)) {
      if (word === '') continue;
      const chars = Array.from(` ${word} `);
      for (let n = minN; n <= maxN; n++) {
        let offset = 0;
        grams.push(chars.slice(offset, offset + n).join(''));
        while (offset + n < chars.length) {
          offset += 1;
          grams.push(chars.slice(offset, offset + n).join(''));
        }
        if (offset === 0) break;
      }
    }
    return grams;
  };
  for (const text of ['a', '가', '나다 라', '😀 이모지 테스트 😀😀', '  공백   많은   문장  ', '', 'ABC def 세부능력 및 특기사항', '𠮷野家 한글']) {
    assert.deepEqual(m.charWbNgrams(text, 1, 3), reference(text, 1, 3), JSON.stringify(text));
  }
});

test('블록으로 분석해도 전문으로 분석한 결과와 같다(규칙만·모델 사용 모두)', async t => {
  const m = await load(t);
  const blocks = m.splitSections(TEXT);
  assert.deepEqual(m.analyzeBlocks(blocks), m.analyzeNarrative(TEXT));
  const bundled = await m.loadBundledModel();
  const quality = await m.loadQualityModel();
  const expected = m.analyzeNarrative(TEXT, { model: bundled, qualityModel: quality });
  assert.equal(expected.ok, true);
  assert.deepEqual(m.analyzeBlocks(blocks, { model: bundled, qualityModel: quality }), expected);
  assert.deepEqual(await m.analyzeBlocksWithBundledModel(blocks), expected);
});

test('블록의 문단을 고치면 분석 결과가 바뀌고 원래 블록은 그대로 남는다', async t => {
  const m = await load(t);
  const blocks = m.splitSections(TEXT);
  const before = m.analyzeBlocks(blocks);
  const snapshot = JSON.stringify(blocks);
  const emptied = blocks.map(block => ({ ...block, entries: [] }));
  assert.equal(before.ok, true);
  assert.deepEqual(m.analyzeBlocks(emptied), { ok: false, reason: 'too-short' });
  assert.equal(JSON.stringify(blocks), snapshot);
  assert.deepEqual(m.analyzeBlocks([]), { ok: false, reason: 'no-sections' });
});

test('블록도 워커를 거쳐 같은 결과를 낸다', async t => {
  const m = await load(t);
  const log = { messages: [] };
  const client = m.createNarrativeWorkerClient({ createWorker: () => fakeWorker(inProcessHandler(m), log) });
  t.after(() => client.dispose());
  const blocks = m.splitSections(TEXT);
  const viaWorker = await client.analyzeBlocks(blocks, { tagKeywords: [{ keyword: '반도체', tag: '반도체' }] });
  const direct = await m.analyzeBlocksOnThisThread(blocks, { tagKeywords: [{ keyword: '반도체', tag: '반도체' }] });
  assert.equal(direct.ok, true);
  assert.deepEqual(viaWorker, direct);
  assert.equal(log.messages[0].kind, 'analyzeBlocks');
  assert.deepEqual(log.messages[0].tagKeywords, [{ keyword: '반도체', tag: '반도체' }]);
});
