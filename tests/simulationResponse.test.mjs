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
