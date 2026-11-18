import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

// 과목 사전 JSON 을 읽어야 해서 다른 테스트처럼 vite 로 모듈을 불러온다.
async function withModules(run) {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  try {
    const { parseRecordGrades } = await server.ssrLoadModule('/src/utils/parseRecordGrades.ts');
    const { snapSubjectName } = await server.ssrLoadModule('/src/utils/subjectCatalog.ts');
    await run({ parseRecordGrades, snapSubjectName });
  } finally {
    await server.close();
  }
}

// 2015 개정 '수학Ⅰ'의 로마 숫자가 OCR에서 띄어 쓴 '1'로 나오는 행(실제 문서가 아니라 모양만 옮긴 예시)이에요.
const lines = [
  '수학           수학 1                    4         74/56, 9(18, 2)           (229)               3',
  '과학           물리학 1                  3         44/57, 8(20, 3)            (60)               6',
  '영어           영어 1               4       77/64, 5(22. 4)        (229)           4',
  '과학           과학탐구실험          1       100/92.8(9.8)        A(227)',
  '국어           국어                  4       89/67, 7(24, 4)          (228)             3',
  '국어           공통국어1             4       80/60.0(10.0)          (228)             2',
].join('\n');

test('이름과 띄어 읽힌 숫자 1은 과목명의 일부로 읽는다', () => withModules(({ parseRecordGrades }) => {
  const rows = parseRecordGrades(lines);
  assert.deepEqual(rows.map(({ name, grade }) => [name, grade]), [
    ['수학1', '3'], ['물리학1', '6'], ['영어1', '4'], ['과학탐구실험', ''], ['국어', '3'], ['공통국어1', '2'],
  ]);
}));

test('단위수가 1인 행의 숫자는 이름에 붙이지 않는다', () => withModules(({ parseRecordGrades }) => {
  const [row] = parseRecordGrades('과학           과학탐구실험          1       100/92.8(9.8)        A(227)   2');
  assert.equal(row.name, '과학탐구실험');
  assert.equal(row.grade, '2');
}));

test('끝 숫자만 다른 이름은 다른 과목으로 보고 바꾸지 않고, 한 글자 깨짐은 맞춘다', () => withModules(({ snapSubjectName }) => {
  assert.equal(snapSubjectName('물리학1', '2022'), '물리학1');
  assert.equal(snapSubjectName('미적분', '2022'), '미적분');
  assert.equal(snapSubjectName('화학Ⅰ', '2022'), '화학Ⅰ');
  assert.equal(snapSubjectName('세계시민과 지러', '2022'), '세계시민과 지리');
  assert.equal(snapSubjectName('공동국어1', '2022'), '공통국어1');
}));
