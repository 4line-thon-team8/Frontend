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
  return server.ssrLoadModule('/src/utils/ocr/gradeTableHint.ts');
}

test('점수꼴 줄이 2줄 이상이면 성적표로 본다', async t => {
  const { looksLikeGradeTable } = await load(t);
  const text = [
    '국어   공통국어1   4   76/72.5(15.7)   (227)   3',
    '수학   공통수학1   4   55/71,4(15.5)   (227)   4',
  ].join('\n');
  assert.equal(looksLikeGradeTable(text), true);
});

test('표 머리글이 읽히면 점수가 깨져도 성적표로 본다', async t => {
  const { looksLikeGradeTable } = await load(t);
  assert.equal(looksLikeGradeTable('과목   단 위 수   석차등급'), true);
  assert.equal(looksLikeGradeTable('교과  과목  단위수  원점수'), true);
});

test('서술 페이지는 성적표로 보지 않는다', async t => {
  const { looksLikeGradeTable } = await load(t);
  const narrative = [
    '공통국어1: 설득하는 글쓰기 단원에서 독자의 입장을 고려함(2025.03.21.) 4 가지 방법을 비교함',
    '학교폭력 예방 교육(2025.03.21.)과 성 인권 교육(2025.09.19.)에 참여함',
    '점수 76/72 처럼 소수점 없는 분수 하나만 있는 줄',
  ].join('\n');
  assert.equal(looksLikeGradeTable(narrative), false);
  assert.equal(looksLikeGradeTable(''), false);
});
