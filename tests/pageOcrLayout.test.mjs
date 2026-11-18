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
  const segment = await server.ssrLoadModule('/src/utils/ocr/segmentTable.ts');
  const clean = await server.ssrLoadModule('/src/utils/ocr/cleanOcrText.ts');
  return { ...segment, ...clean };
}

/** 흰 바탕에 선·글자 덩어리를 그려 스캔 페이지를 흉내 내요. */
function page(width, height) {
  const gray = new Uint8Array(width * height).fill(255);
  const api = {
    gray,
    hline(y, x0, x1, thickness = 2) { for (let t = 0; t < thickness; t++) for (let x = x0; x <= x1; x++) gray[(y + t) * width + x] = 0; return api; },
    vline(x, y0, y1, thickness = 2) { for (let t = 0; t < thickness; t++) for (let y = y0; y <= y1; y++) gray[y * width + x + t] = 0; return api; },
    /** 글자 줄처럼 짧은 선분이 이어진 덩어리 */
    text(x0, y0, x1, lines) { for (let i = 0; i < lines; i++) for (let x = x0; x < x1; x += 14) for (let y = y0 + i * 22; y < y0 + i * 22 + 12; y++) for (let k = 0; k < 8; k++) gray[y * width + x + k] = 0; return api; },
    box(left, top, right, bottom) { return api.hline(top, left, right).hline(bottom, left, right).vline(left, top, bottom).vline(right, top, bottom); },
  };
  return api;
}

const W = 1000;
const H = 1400;

/** 학년|영역|시간|특기사항 4칸 표: 제목줄 + 서술 행 2개 */
function narrativeTable() {
  const p = page(W, H);
  p.hline(200, 100, 900).hline(260, 100, 900).hline(700, 100, 900).hline(1100, 100, 900);
  for (const x of [100, 220, 330, 400, 900]) p.vline(x, 260, 1100);
  p.vline(100, 200, 260).vline(900, 200, 260);
  p.text(420, 280, 880, 6).text(420, 720, 880, 8);
  return p;
}

test('서술 표를 찾으면 라벨 칸과 서술 칸으로 나눈다', async t => {
  const { segmentTable } = await load(t);
  const regions = segmentTable(narrativeTable().gray, W, H);
  assert.ok(regions);
  const narratives = regions.filter(r => r.kind === 'narrative');
  const labels = regions.filter(r => r.kind === 'label');
  assert.equal(narratives.length, 2);
  assert.equal(labels.length, 2);
  for (const r of narratives) {
    assert.ok(r.x >= 400 && r.x + r.width <= 900, '서술 칸은 마지막 세로선 오른쪽이다');
  }
  assert.ok(narratives[0].y >= 260 && narratives[0].y + narratives[0].height <= 700);
  assert.ok(narratives[1].y >= 700 && narratives[1].y + narratives[1].height <= 1100);
});

test('칸은 위에서 아래 순서로, 같은 높이면 라벨이 서술보다 먼저 나온다', async t => {
  const { segmentTable } = await load(t);
  const regions = segmentTable(narrativeTable().gray, W, H);
  const sorted = [...regions].sort((a, b) => a.y - b.y || a.x - b.x);
  assert.deepEqual(regions, sorted);
  const firstBand = regions.filter(r => r.kind === 'label' || r.kind === 'narrative').slice(0, 2);
  assert.deepEqual(firstBand.map(r => r.kind), ['label', 'narrative']);
});

test('표 오른쪽에도 세로선이 있으면 성적표로 보고 가로 전체를 한 칸으로 읽는다', async t => {
  const { segmentTable } = await load(t);
  const p = page(W, H);
  p.hline(200, 100, 900).hline(300, 100, 900).hline(500, 100, 900).hline(700, 100, 900);
  for (const x of [100, 220, 400, 550, 700, 900]) p.vline(x, 200, 700);
  const regions = segmentTable(p.gray, W, H);
  assert.ok(regions);
  assert.ok(regions.some(r => r.kind === 'table'));
  assert.ok(!regions.some(r => r.kind === 'narrative'));
});

test('세로선이 없는 칸은 전체 폭으로 읽는다', async t => {
  const { segmentTable } = await load(t);
  const p = page(W, H);
  p.hline(200, 100, 900).hline(300, 100, 900).hline(700, 100, 900).vline(100, 200, 700).vline(900, 200, 700);
  p.text(120, 320, 880, 8);
  const regions = segmentTable(p.gray, W, H);
  assert.ok(regions);
  const full = regions.filter(r => r.kind === 'full');
  assert.ok(full.length >= 1);
  assert.ok(full[0].width > 700);
});

test('뷰어 테두리처럼 페이지 전체를 가로지르는 줄은 표로 보지 않는다', async t => {
  const { segmentTable } = await load(t);
  const p = narrativeTable();
  p.hline(1300, 0, W - 1);
  const regions = segmentTable(p.gray, W, H);
  assert.ok(regions);
  assert.ok(regions.every(r => r.y + r.height <= 1200), '테두리 아래는 표에 포함하지 않는다');
});

test('바닥글 표는 본문 표와 오른쪽 끝이 달라 섞이지 않는다', async t => {
  const { segmentTable } = await load(t);
  const p = narrativeTable();
  p.hline(1250, 80, 960).hline(1290, 80, 960).hline(1330, 80, 960);
  const regions = segmentTable(p.gray, W, H);
  assert.ok(regions);
  assert.ok(regions.filter(r => r.kind === 'narrative').every(r => r.x + r.width <= 900));
});

test('표가 없는 페이지는 null을 돌려준다(호출한 쪽이 페이지 전체를 읽는다)', async t => {
  const { segmentTable } = await load(t);
  assert.equal(segmentTable(page(W, H).text(100, 300, 900, 20).gray, W, H), null);
  assert.equal(segmentTable(new Uint8Array(W * H).fill(255), W, H), null);
});

test('표 밖에 남은 제목 줄도 gap 칸으로 읽는다', async t => {
  const { segmentTable } = await load(t);
  const p = narrativeTable();
  p.text(300, 100, 700, 2);
  const regions = segmentTable(p.gray, W, H);
  assert.ok(regions.some(r => r.kind === 'gap' && r.y < 200));
});

test('OCR 찌꺼기 줄과 이름이 든 줄을 지운다', async t => {
  const { cleanOcrText } = await load(t);
  const text = cleanOcrText([
    '문서확인번호: 1754-8105-0180-1622 (신청인 : 홍길동)',
    '| | |',
    '동아리 활동에서 역할을 맡아 성실히 수행함.',
    '',
    '',
    '‥ ·',
    '인천고등학교 2025년 8월 10일 3/18 반 1 번호 18 이름 홍길동',
    '탐구 보고서를 작성하여 발표함.',
  ].join('\n'));
  assert.equal(text, '동아리 활동에서 역할을 맡아 성실히 수행함.\n\n탐구 보고서를 작성하여 발표함.');
  assert.ok(!text.includes('홍길동'));
});

test('라벨 칸의 여러 줄은 한 줄로 합쳐 영역 제목이 되게 한다', async t => {
  const { joinLabelLines } = await load(t);
  assert.equal(joinLabelLines('1\n\n자율\n활동\n34'), '1 자율 활동 34');
});

test('표 세로선이 한글 자모 찌꺼기로 읽힌 글자를 지운다', async t => {
  const { cleanOcrText } = await load(t);
  assert.equal(cleanOcrText('동아리활동 ᅵ 18'), '동아리활동 18');
});
