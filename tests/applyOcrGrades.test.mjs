import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('maps exact names and only replaces the S-03 draft after explicit confirmation', async () => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  try {
    const { applyOcrGrades, reviewOcrGrades } = await server.ssrLoadModule('/src/utils/applyOcrGrades.ts');
    const existing = [{ id: 'manual', name: '공통수학1', grade: '4' }];
    const draft = { curriculum: '2022', subjects: existing, majorIds: ['existing-major'] };
    const candidates = [{ id: 'ocr-1', name: '국어', grade: '1' }];
    assert.equal(reviewOcrGrades(candidates, draft.curriculum).valid, false);
    assert.equal(applyOcrGrades(draft, candidates, true), draft);

    const edited = [{ ...candidates[0], name: '공통국어1', grade: '2' }];
    const [review] = reviewOcrGrades(edited, draft.curriculum).reviews;
    assert.equal(review.status, 'included');
    assert.ok(review.subjectCode);
    assert.equal(review.gradeValue, 2);
    assert.equal(applyOcrGrades(draft, edited, false), draft);
    assert.equal(applyOcrGrades(draft, [], true), draft);
    assert.equal(applyOcrGrades(draft, [{ ...edited[0], grade: '' }], true), draft);
    assert.equal(applyOcrGrades(draft, [...edited, { ...edited[0], id: 'ocr-2' }], true), draft);
    assert.deepEqual(applyOcrGrades(draft, edited, true), { ...draft, subjects: edited });
    assert.equal(draft.subjects, existing);
  } finally {
    await server.close();
  }
});
