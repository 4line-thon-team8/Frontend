import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { buildHolisticSubmitPayload } = await server.ssrLoadModule('/src/utils/holistic/submitPayload.ts');
test.after(() => server.close());

const citation = { id: 'c1', text: '탐구 보고서를 작성함', indicators: ['A3'], year: 1, section: 'subject', quality: 0.9 };
const payload = { rulesVersion: '0.7.0', coverage: { sectionChars: {}, years: [1] }, indicatorSignals: [], interestTags: [], evidence: [] };
const ok = { ok: true, payload, citations: [citation] };

test('플래그가 꺼져 있으면 citations 키가 없다', () => {
  const out = buildHolisticSubmitPayload(ok, false);
  assert.equal(out, payload);
  assert.equal('citations' in out, false);
});

test('플래그가 켜져 있으면 citations 를 담고 원본 payload 는 바뀌지 않는다', () => {
  const out = buildHolisticSubmitPayload(ok, true);
  assert.deepEqual(out.citations, [citation]);
  assert.equal('citations' in payload, false);
});

test('구절이 없으면 플래그가 켜져 있어도 citations 키를 넣지 않는다', () => {
  const out = buildHolisticSubmitPayload({ ok: true, payload, citations: [] }, true);
  assert.equal('citations' in out, false);
});

test('분석 실패·null 은 null', () => {
  assert.equal(buildHolisticSubmitPayload({ ok: false, reason: 'too-short' }, true), null);
  assert.equal(buildHolisticSubmitPayload(null, true), null);
});
