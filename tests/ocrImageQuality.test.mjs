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
  return server.ssrLoadModule('/src/utils/ocr/imageQuality.ts');
}

const WIDTH = 600;
const HEIGHT = 400;

/** 흰 종이에 가는 글자 줄(획 2px)을 그린 이미지. */
function textPage(paper = 245, ink = 30) {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT).fill(paper);
  for (let line = 0; line < 14; line += 1) {
    for (let x = 30; x < 570; x += 1) {
      if (x % 9 < 5) for (let dy = 0; dy < 2; dy += 1) data[(30 + line * 25 + dy + (x % 3)) * WIDTH + x] = ink;
      if (x % 9 < 3) for (let dy = 0; dy < 8; dy += 1) data[(22 + line * 25 + dy) * WIDTH + x] = ink;
    }
  }
  return { data, width: WIDTH, height: HEIGHT };
}

/** 상자 평균을 여러 번 적용해 초점이 흐린 사진을 흉내 낸다. */
function blurred(image, radius, passes) {
  let current = Float32Array.from(image.data);
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(current.length);
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            const yy = Math.min(HEIGHT - 1, Math.max(0, y + dy));
            const xx = Math.min(WIDTH - 1, Math.max(0, x + dx));
            sum += current[yy * WIDTH + xx];
            count += 1;
          }
        }
        next[y * WIDTH + x] = sum / count;
      }
    }
    current = next;
  }
  return { data: Uint8ClampedArray.from(current), width: WIDTH, height: HEIGHT };
}

function scaled(image, factor, offset = 0) {
  return { ...image, data: Uint8ClampedArray.from(image.data, value => value * factor + offset) };
}

test('선명한 사진은 문제가 없다', async t => {
  const { assessImageQuality } = await load(t);
  const quality = assessImageQuality(textPage());
  assert.deepEqual(quality.issues, []);
  assert.ok(quality.paperLevel > 200);
});

test('심하게 흐린 사진은 BLURRY, 약하게 흐린 사진은 SOFT 로 구분한다', async t => {
  const { assessImageQuality } = await load(t);
  const sharp = assessImageQuality(textPage()).sharpness;
  const soft = assessImageQuality(blurred(textPage(), 1, 1));
  const heavy = assessImageQuality(blurred(textPage(), 3, 3));
  assert.ok(heavy.sharpness < soft.sharpness && soft.sharpness < sharp);
  assert.ok(heavy.issues.includes('BLURRY'), `심한 흐림: ${heavy.sharpness}`);
  assert.ok(!soft.issues.includes('BLURRY'));
});

test('어두운 사진은 DARK 만 알리고 흐림으로 오인하지 않는다', async t => {
  const { assessImageQuality } = await load(t);
  const quality = assessImageQuality(scaled(textPage(), 0.3));
  assert.deepEqual(quality.issues, ['DARK']);
});

test('대비가 낮은 사진은 LOW_CONTRAST 만 알리고 흐림으로 오인하지 않는다', async t => {
  const { assessImageQuality } = await load(t);
  const quality = assessImageQuality(textPage(180, 160));
  assert.deepEqual(quality.issues, ['LOW_CONTRAST']);
});

test('아주 작은 이미지도 오류 없이 값을 돌려준다', async t => {
  const { assessImageQuality } = await load(t);
  const quality = assessImageQuality({ data: new Uint8ClampedArray(4).fill(200), width: 2, height: 2 });
  assert.equal(typeof quality.sharpness, 'number');
  assert.ok(Array.isArray(quality.issues));
});
