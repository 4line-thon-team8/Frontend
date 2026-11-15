import assert from 'node:assert/strict';
import test from 'node:test';
import { detectOcrTables, recognizeOcrTable } from '../src/utils/ocrTable.ts';

test('detects a ruled table and only reads grades under a verified grade heading', async () => {
  const tables = detectOcrTables(210, 110, (x, y) => [5, 45, 85].includes(y) ||
    (y >= 5 && y <= 85 && [5, 70, 130, 200].includes(x)));
  assert.equal(tables.length, 1);
  const [[head, row]] = tables;
  const seen = [];
  const results = await recognizeOcrTable(tables, async cell => {
    seen.push(cell);
    return { text: ['과목명', '단위수', '석차등급', '생명과학 |', '2등급'][seen.length - 1], confidence: 95 };
  });
  assert.deepEqual(seen, [...head, row[0], row[2]]);
  assert.deepEqual(results, [{ id: 'ocr-1', name: '생명과학 |', grade: '2' }]);
  const unclear = await recognizeOcrTable(tables, async cell => ({
    text: ['과목명', '단위수', '석차등급'][head.indexOf(cell)] ?? '4',
    confidence: cell === head[2] ? 60 : 95,
  }));
  assert.deepEqual(unclear, []);
});

test('does not create a grid from a blank or broken ruled image', () => {
  assert.deepEqual(detectOcrTables(210, 110, () => false), []);
  assert.deepEqual(detectOcrTables(210, 110, (x, y) => x < 100 && [5, 45, 85].includes(y)), []);
});
