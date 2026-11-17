import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRecordGrades } from '../src/utils/parseRecordGrades.ts';

// 스캔 생기부 OCR 결과에서 과목 행만 옮긴 것이에요. 성취도 칸은 실제로 이렇게 깨져서 나와요.
const ocr = [
  '6. 교과학습발달상황',
  '학기       교과            과목       단위수    (표준편차)    (수강자수) | -장동휴     비고',
  '국어            국어              4     90/63.5(14.0)    시(375)      1',
  '수학           수학              4     71/61.9(18.2) ㅣ 0ㅇ(375)      4',
  '시    시   덕',
  '사카에 )/도디포 | 농합사회         3 | 85/71102.6) ㅣ 8(375)     3',
  '과학            과학탐구실험        1     96/89.4(5.7)    쇼(375)',
  '기술ㆍ가정/제2외                                ~                         <',
  '국어/한문/교양       정보                     2        92/74.4(9.9)       (375)        2',
  '국어/한문/교양       화학Ⅰ     3 | 88/70.1(10.2) | B(180) | 2',
  '진로도우미활동(온ㆍ오프라인 진',
  '2021.03.11.                (학교)OO고등학교      봉사활동 소양교육              1      1',
].join('\n');

test('reads subject, credits-anchored rows and trailing 석차등급', () => {
  const rows = parseRecordGrades(ocr).filter(row => row.name);
  assert.deepEqual(rows.map(({ name, grade }) => [name, grade]), [
    ['국어', '1'], ['수학', '4'], ['농합사회', '3'], ['과학탐구실험', ''], ['정보', '2'], ['화학Ⅰ', '2'],
  ]);
});

test('accepts a garbled opening parenthesis in the score token', () => {
  const rows = parseRecordGrades(ocr);
  // '85/71102.6)'처럼 여는 괄호가 숫자로 깨져도 행을 놓치지 않아요.
  assert.equal(rows.length, 6);
  assert.ok(rows.every(row => /^record-\d+$/u.test(row.id)));
});

test('does not mistake the 수강자수 parentheses or volunteer-hour rows for a grade', () => {
  const [row] = parseRecordGrades('국어  국어  4  90/63.5(14.0)  A(375)');
  assert.equal(row?.grade, '');
  assert.deepEqual(parseRecordGrades('2021.03.11. (학교)OO고등학교 환경보호 활동 1 22'), []);
});

test('returns nothing for text without a grade table', () => {
  assert.deepEqual(parseRecordGrades(''), []);
  assert.deepEqual(parseRecordGrades('창의적 체험활동상황\n자율활동 학급 회장으로서 활동함'), []);
});

test('keeps the trailing digit of 2022 curriculum names', () => {
  const rows = parseRecordGrades([
    '공통국어1   공통국어1   4   88/70.2(12.0)   B(300)   2',
    '국어   공통수학2 | 4 | 90/65.5(13.1) | A(300) | 1',
  ].join('\n'));
  assert.deepEqual(rows.map(({ name, grade }) => [name, grade]), [['공통국어1', '2'], ['공통수학2', '1']]);
});
