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
  return server.ssrLoadModule('/src/services/simulationApi.ts');
}

const card = extra => ({ rank: 1, university: '가대학교', department: '컴퓨터공학과', admissionType: '학생부종합', category: 'REACH', reason: { text: '이유', generationMethod: 'template' }, ...extra });

test('서류 적합도와 서류 반영 구간을 읽는다', async t => {
  const { parseSimulationResult } = await load(t);
  const result = parseSimulationResult({
    recommendations: [card({ overallCategory: 'MATCH', documentFit: { level: 'HIGH', basis: ['ACADEMIC', 'MAJOR_FIT', 3] } })],
    holistic: { status: 'APPLIED', skipReason: null },
  });
  const [item] = result.recommendations;
  assert.equal(item.category, 'REACH');
  assert.equal(item.overallCategory, 'MATCH');
  assert.deepEqual(item.documentFit, { level: 'HIGH', basis: ['ACADEMIC', 'MAJOR_FIT'] });
  assert.deepEqual(result.holistic, { status: 'APPLIED', skipReason: null });
});

test('서류 관련 필드가 없거나 모르는 값이면 없는 것으로 읽는다', async t => {
  const { parseSimulationResult } = await load(t);
  const result = parseSimulationResult({
    recommendations: [card({ documentFit: { level: 'EXTREME', basis: [] } })],
    holistic: { status: 'WHATEVER' },
  });
  assert.equal(result.recommendations[0].overallCategory, null);
  assert.equal(result.recommendations[0].documentFit, null);
  assert.deepEqual(result.holistic, { status: 'NOT_PROVIDED', skipReason: null });

  const missing = parseSimulationResult({ recommendations: [card({})] });
  assert.deepEqual(missing.holistic, { status: 'NOT_PROVIDED', skipReason: null });
});

test('반영하지 못했으면 이유를 함께 읽는다', async t => {
  const { parseSimulationResult } = await load(t);
  const result = parseSimulationResult({
    recommendations: [card({})],
    holistic: { status: 'SKIPPED', skipReason: 'TOO_SHORT' },
  });
  assert.deepEqual(result.holistic, { status: 'SKIPPED', skipReason: 'TOO_SHORT' });
});

test('holistic 의 활동 요약·강점·학과별 조언을 읽는다', async t => {
  const { parseSimulationResult } = await load(t);
  const result = parseSimulationResult({
    recommendations: [card()],
    holistic: {
      status: 'APPLIED',
      skipReason: null,
      activitySummary: { text: '탐구력이 눈에 띄어요.', generationMethod: 'TEMPLATE' },
      strengths: [
        { indicatorId: 'A3', label: '탐구력', level: 5, description: '탐구 활동이 보여요.' },
        { indicatorId: 'C3', label: '성실성과 규칙준수', level: 9, description: '' },
        { indicatorId: 'X', level: 4 },
      ],
      majorAdvices: [{ department: '컴퓨터공학과', advice: { text: '과정을 남겨 보세요.', generationMethod: 'LLM' } }, { department: '빈 조언', advice: { text: ' ' } }],
    },
  });
  assert.deepEqual(result.holisticStrategy, {
    activitySummary: '탐구력이 눈에 띄어요.',
    strengths: [
      { indicatorId: 'A3', label: '탐구력', level: 5, description: '탐구 활동이 보여요.' },
      { indicatorId: 'C3', label: '성실성과 규칙준수', level: 5, description: '' },
    ],
    majorAdvices: [{ department: '컴퓨터공학과', advice: '과정을 남겨 보세요.' }],
    detail: null,
  });
});

test('holistic.detail 의 상세 창 네 영역을 읽는다', async t => {
  const { parseSimulationResult } = await load(t);
  const item = text => ({ text, generationMethod: 'TEMPLATE' });
  const result = parseSimulationResult({
    recommendations: [card()],
    holistic: {
      status: 'APPLIED',
      detail: {
        overview: { text: '활동 흐름이에요.', generationMethod: 'LLM' },
        strengthEvidence: [item('근거 1'), item('근거 2'), item('근거 3'), item('근거 4')],
        improvements: null,
        nextSteps: [item(' '), item('모집요강을 확인해 보세요.')],
      },
    },
  });
  assert.deepEqual(result.holisticStrategy.detail, {
    overview: '활동 흐름이에요.',
    strengthEvidence: ['근거 1', '근거 2', '근거 3'],
    improvements: [],
    nextSteps: ['모집요강을 확인해 보세요.'],
  });
  const emptyDetail = parseSimulationResult({
    recommendations: [card()],
    holistic: { status: 'APPLIED', detail: { overview: null, strengthEvidence: [], improvements: [], nextSteps: [] } },
  });
  assert.equal(emptyDetail.holisticStrategy.detail, null);
});

test('1단계 배포·SKIPPED·필드 없음이면 비어 있는 활동 전략', async t => {
  const { parseSimulationResult } = await load(t);
  const empty = { activitySummary: null, strengths: [], majorAdvices: [], detail: null };
  const stage1 = parseSimulationResult({
    recommendations: [card()],
    holistic: { status: 'APPLIED', activitySummary: null, strengths: [{ indicatorId: 'A3', label: '탐구력', level: 4, description: '' }], majorAdvices: [] },
  });
  assert.equal(stage1.holisticStrategy.activitySummary, null);
  assert.equal(stage1.holisticStrategy.strengths.length, 1);
  assert.deepEqual(stage1.holisticStrategy.majorAdvices, []);
  const skipped = parseSimulationResult({
    recommendations: [card()],
    holistic: { status: 'SKIPPED', skipReason: 'TOO_SHORT', strengths: [{ indicatorId: 'A3', label: '탐구력', level: 4 }] },
  });
  assert.deepEqual(skipped.holisticStrategy, empty);
  assert.deepEqual(parseSimulationResult({ recommendations: [card()], holistic: { status: 'APPLIED' } }).holisticStrategy, empty);
  assert.deepEqual(parseSimulationResult({ recommendations: [card()] }).holisticStrategy, empty);
});
