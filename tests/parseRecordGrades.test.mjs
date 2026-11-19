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

test('reads rows where OCR turned the decimal point into a comma', () => {
  const rows = parseRecordGrades([
    '국어      국어          3   75/73, 5(10, 0)    C(90)     5',
    '과학         통합과학           3    76/75.3(10.4)     C(90)       5',
    '한국사                한국사        3        88/69. 9(20, 9)           B(90)               3',
  ].join('\n'));
  assert.deepEqual(rows.map(({ name, grade }) => [name, grade]), [['국어', '5'], ['통합과학', '5'], ['한국사', '3']]);
});

// 과목 사전(JSON)은 앱에서 넘겨 주므로 테스트에서는 필요한 이름만 가진 사전으로 대신해요.
const known = name => ['독서와작문', '확률과통계', '영어독해와작문', '현대사회와윤리', '세계시민과지리', '화법과언어', '사회와문화'].includes(name);

test('2022 과목 중 띄어 쓰는 이름은 한 과목으로 읽는다', () => {
  const text = [
    '국어   독서와 작문   3   99/72.5(12.2)   A(113)   1',
    '수학   확률과 통계   3   90/67.8(14.6)   A(171)   2',
    '영어   영어 독해와 작문   3   100/72.6(14.8)   A(173)   1',
    '사회   현대사회와 윤리   3   88/70.1(10.2)   B(180)   3',
    '사회   세계시민과 지리   3   85/66.0(12.0)   B(150)   2',
    '국어   화법과 언어   3   92/70.0(11.0)   A(160)   2',
    '사회   사회와 문화   3   95/70.0(11.0)   A(160)   1',
  ].join('\n');
  assert.deepEqual(parseRecordGrades(text, known).map(({ name, grade }) => [name, grade]), [
    ['독서와작문', '1'], ['확률과통계', '2'], ['영어독해와작문', '1'], ['현대사회와윤리', '3'],
    ['세계시민과지리', '2'], ['화법과언어', '2'], ['사회와문화', '1'],
  ]);
});

test('교과 칸이 병합되어 빠진 행과 칸 선이 섞인 행도 띄어 쓴 이름을 읽는다', () => {
  const text = [
    '독서와 작문   3   99/72.5(12.2)   A(113)   1',
    '수학 | 확률과 | 통계 | 3 | 90/67.8(14.6) | A(171) | 2',
  ].join('\n');
  assert.deepEqual(parseRecordGrades(text, known).map(({ name, grade }) => [name, grade]), [['독서와작문', '1'], ['확률과통계', '2']]);
});

test('사전에 없는 띄어 쓴 이름은 기존 규칙대로 읽고 한 단어 이름은 그대로다', () => {
  const text = [
    '국어   국어   4   90/63.5(14.0)   A(375)   1',
    '국어   처음 보는 과목   3   88/70.0(10.0)   B(100)   2',
  ].join('\n');
  assert.deepEqual(parseRecordGrades(text, known).map(({ name, grade }) => [name, grade]), [['국어', '1'], ['과목', '2']]);
  // 사전을 넘기지 않으면 기존 동작 그대로예요.
  assert.deepEqual(parseRecordGrades('국어   독서와 작문   3   99/72.5(12.2)   A(113)   1').map(row => row.name), ['작문']);
});
