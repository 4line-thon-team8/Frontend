import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import test from 'node:test';
import { createServer } from 'vite';

test('processes photos in order, retains duplicate subjects and joins readable text', async t => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  t.after(() => server.close());
  const { recognizeGradeImages } = await server.ssrLoadModule('/src/utils/recognizeGradeImages.ts');
  const { reviewOcrGrades } = await server.ssrLoadModule('/src/utils/applyOcrGrades.ts');
  const files = ['first', 'failed', 'empty', 'last'].map(name => new File([], name));
  const seen = [];
  const result = await recognizeGradeImages(files, new globalThis.AbortController().signal, async (file, index) => {
    assert.equal(file, files[index]);
    seen.push(file.name);
    if (file.name === 'failed') throw new Error('worker failed');
    return {
      text: file.name,
      words: [],
      tableSubjects: file.name === 'empty' ? [] : [{ id: 'ocr-1', name: '공통국어1', grade: index ? '3' : '2' }],
    };
  });
  assert.deepEqual(seen, files.map(file => file.name));
  assert.deepEqual(result, {
    subjects: [
      { id: 'ocr-1', name: '공통국어1', grade: '2' },
      { id: 'ocr-2', name: '공통국어1', grade: '3' },
    ],
    text: 'first\nempty\nlast',
    failed: 1,
    empty: 1,
  });
  assert.equal(reviewOcrGrades(result.subjects, '2022').duplicate, true);
  assert.equal(reviewOcrGrades(result.subjects, '2022').valid, false);

  const empty = await recognizeGradeImages(files.slice(0, 1), new globalThis.AbortController().signal, async () =>
    ({ text: '서술', words: [], tableSubjects: [] }));
  assert.deepEqual(empty, { subjects: [], text: '서술', failed: 0, empty: 1 });

  const request = new globalThis.AbortController();
  const attempted = [];
  await assert.rejects(recognizeGradeImages(files, request.signal, async file => {
    attempted.push(file.name);
    request.abort();
    throw request.signal.reason;
  }), { name: 'AbortError' });
  assert.deepEqual(attempted, ['first']);
});
