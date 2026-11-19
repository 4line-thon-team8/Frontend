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
  return server.ssrLoadModule('/src/utils/ocr/flattenIllumination.ts');
}

const WIDTH = 240;
const HEIGHT = 160;

/** 흰 종이에 가는 글자 줄을 그리고, 왼쪽에서 오른쪽으로 점점 어두워지는 그림자를 입힌다. */
function shadowedPage(shadow) {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const ink = y % 16 >= 6 && y % 16 < 8 && x > 20 && x < 220 && x % 6 < 4;
      const light = 1 - shadow * (x / WIDTH);
      data[y * WIDTH + x] = (ink ? 40 : 250) * light;
    }
  }
  return { data, width: WIDTH, height: HEIGHT };
}

function paperMean(image, columnStart, columnEnd) {
  let sum = 0;
  let count = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = columnStart; x < columnEnd; x += 1) {
      const value = image.data[y * image.width + x];
      if (value > 120) { sum += value; count += 1; }
    }
  }
  return sum / count;
}

test('그림자가 있어도 종이 밝기가 좌우로 비슷해진다', async t => {
  const { flattenIllumination } = await load(t);
  const page = shadowedPage(0.18);
  const flat = flattenIllumination(page);
  const beforeGap = paperMean(page, 10, 50) - paperMean(page, 190, 230);
  const afterGap = Math.abs(paperMean(flat, 10, 50) - paperMean(flat, 190, 230));
  assert.ok(beforeGap > 25, `보정 전 차이: ${beforeGap}`);
  assert.ok(afterGap < 8, `보정 후 차이: ${afterGap}`);
});

test('글자는 보정 후에도 종이보다 확실히 어둡다', async t => {
  const { flattenIllumination } = await load(t);
  const flat = flattenIllumination(shadowedPage(0.18));
  let inkSum = 0;
  let inkCount = 0;
  for (let x = 24; x < 216; x += 6) { inkSum += flat.data[6 * WIDTH + x]; inkCount += 1; }
  assert.ok(inkSum / inkCount < 90, `글자 밝기: ${inkSum / inkCount}`);
  assert.ok(paperMean(flat, 100, 140) > 235);
});

test('이미 균일한 종이는 거의 바뀌지 않는다', async t => {
  const { flattenIllumination } = await load(t);
  const page = shadowedPage(0);
  const flat = flattenIllumination(page);
  let changed = 0;
  for (let index = 0; index < page.data.length; index += 1) {
    if (Math.abs(page.data[index] - flat.data[index]) > 12) changed += 1;
  }
  assert.ok(changed / page.data.length < 0.02, `바뀐 비율: ${changed / page.data.length}`);
});

test('큰 짙은 칸(표 머리글)은 그림자로 오인해 밝히지 않는다', async t => {
  const { flattenIllumination } = await load(t);
  const data = new Uint8ClampedArray(WIDTH * HEIGHT).fill(250);
  for (let y = 40; y < 100; y += 1) for (let x = 60; x < 180; x += 1) data[y * WIDTH + x] = 70;
  const flat = flattenIllumination({ data, width: WIDTH, height: HEIGHT });
  assert.ok(flat.data[70 * WIDTH + 120] < 120, `머리글 칸 밝기: ${flat.data[70 * WIDTH + 120]}`);
});

test('입력 이미지는 바꾸지 않고, 너무 작은 이미지는 그대로 돌려준다', async t => {
  const { flattenIllumination, toGray } = await load(t);
  const page = shadowedPage(0.3);
  const copy = Uint8ClampedArray.from(page.data);
  flattenIllumination(page);
  assert.deepEqual(page.data, copy);
  const tiny = { data: Uint8ClampedArray.from([10, 20, 30, 40]), width: 2, height: 2 };
  assert.deepEqual(flattenIllumination(tiny).data, tiny.data);
  assert.equal(toGray([255, 255, 255, 0], 1, 1).data[0], 255);
});
