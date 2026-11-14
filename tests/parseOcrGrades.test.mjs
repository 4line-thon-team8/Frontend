import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOcrGrades } from '../src/utils/parseOcrGrades.ts';

function word(text, x0, y0, width = 30, confidence = 95) {
  return { text, confidence, bbox: { x0, y0, x1: x0 + width, y1: y0 + 16 } };
}

const headers = [
  word('과목명', 40, 100, 50),
  word('단위수', 180, 100, 45),
  word('석차등급', 260, 100, 64),
];

const splitHeaders = [
  word('과목', 40, 100, 30), word('명', 72, 102, 14),
  word('단', 180, 100, 14), word('위수', 196, 101, 28),
  word('석', 260, 100, 14), word('차', 276, 102, 14),
  word('등', 292, 101, 14), word('급', 308, 100, 14),
];

test('uses column space beyond the heading ink and reads split grade tokens', () => {
  const words = [word('구분', 5, 100, 20), ...splitHeaders, word('비고', 385, 100, 30),
    word('국어', 34, 124, 19), word('4', 199, 124, 9),
    word('1', 245, 124, 9), word('등급', 256, 124, 29)];
  assert.deepEqual(parseOcrGrades(words), [{ id: 'ocr-1', name: '국어', grade: '1' }]);
});

test('requires an identifiable credits column before reading grade numbers', () => {
  assert.deepEqual(parseOcrGrades([
    headers[0], headers[2], word('영어', 40, 124), word('4', 265, 124, 10),
  ]), []);
});

test('pairs shorter digits with the same row when the row has positive vertical alignment', () => {
  const digit = { ...word('2', 280, 134, 10), bbox: { x0: 280, x1: 290, y0: 134, y1: 140 } };
  const words = [...headers, word('한국사', 40, 124), word('4', 195, 124, 10), digit,
    word('영어', 40, 148), word('3', 195, 148, 10)];
  assert.deepEqual(parseOcrGrades(words).map(({ grade }) => grade), ['2', '']);
});

test('does not stop at a normal first-row gap when split subject letters have a short shared box', () => {
  const words = [word('과목', 40, 97, 30), word('명', 72, 104, 14), ...headers.slice(1),
    word('한국사', 40, 137), word('2', 282, 137, 10)];
  assert.equal(parseOcrGrades(words)[0]?.grade, '2');
});

test('reconstructs adjacent header fragments from coordinates despite shuffled OCR order', () => {
  const words = [...splitHeaders, word('공통수학1', 40, 124, 90),
    word('4', 195, 124, 10), word('2등급', 277, 124, 34)];
  assert.deepEqual(parseOcrGrades(words.reverse()), [{ id: 'ocr-1', name: '공통수학1', grade: '2' }]);
});

test('rejects header fragments separated by a row, a wide gap, or low confidence', () => {
  const body = [word('한국사', 40, 124), word('2', 282, 124, 10)];
  const prefix = splitHeaders.slice(0, -1);
  for (const last of [word('급', 308, 118, 14), word('급', 340, 100, 14), word('급', 308, 100, 14, 79)]) {
    assert.deepEqual(parseOcrGrades([...prefix, last, ...body]), []);
  }
});

test('leaves grades empty when split headers are found but only credits were recognized', () => {
  const words = [...splitHeaders, word('국어', 40, 124), word('3', 193, 124, 10),
    word('수학', 40, 148), word('4', 193, 148, 10)];
  assert.deepEqual(parseOcrGrades(words).map(({ grade }) => grade), ['', '']);
});

test('pairs positioned grades with subject names, excluding unrelated text and credits', () => {
  const words = [...headers, word('는 >', 40, 20), word('공통수학1', 40, 124, 90),
    word('4', 195, 124), word('2', 282, 124, 10)];
  assert.deepEqual(parseOcrGrades(words.reverse()), [{ id: 'ocr-1', name: '공통수학1', grade: '2' }]);
});

test('keeps missing, uncertain and conflicting grades empty for review', () => {
  const words = [...headers, word('화학Ⅰ', 40, 124), word('4', 195, 124),
    word('영어', 40, 148), word('2', 275, 148, 10, 60),
    word('한국사', 40, 172), word('1', 275, 172, 10), word('2', 295, 172, 10)];
  assert.deepEqual(parseOcrGrades(words).map(({ name, grade }) => [name, grade]),
    [['화학Ⅰ', ''], ['영어', ''], ['한국사', '']]);
});

test('requires one clear header and never attaches a grade from a different row', () => {
  const name = word('국어', 40, 124);
  const grade = word('2', 282, 142, 10);
  assert.deepEqual(parseOcrGrades([name, grade]), []);
  assert.deepEqual(parseOcrGrades([...headers, ...headers, name, grade]), []);
  assert.equal(parseOcrGrades([...headers, name, grade])[0].grade, '');
});
