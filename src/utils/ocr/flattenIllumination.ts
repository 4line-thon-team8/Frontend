/**
 * 휴대폰으로 찍은 종이 사진의 조명 불균형(그림자, 한쪽만 밝음)을 없앤다.
 * 종이는 흰색이라는 가정으로 "배경 밝기"를 추정하고, 각 픽셀을 그 배경 밝기로 나눠 종이를 균일한 흰색으로 맞춘다.
 *
 * 글자보다 큰 범위의 밝기 변화만 배경으로 보도록, 줄인 이미지에서 최대값 필터(글자 지우기)와 박스 블러(부드럽게)로
 * 배경을 추정한 뒤 원본 크기로 보간해서 쓴다. 필터 크기는 이미지 긴 변에 대한 비율로 정하므로 해상도와 무관하게 비슷하게 동작한다.
 * 브라우저 API에 기대지 않는 순수 함수라 워커와 Node 테스트에서 같이 쓴다.
 */

export interface GrayImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** 배경 추정은 이 길이로 줄인 이미지에서 한다. */
const BACKGROUND_LONG_SIDE = 600;
/** 글자를 지우는 최대값 필터 반경(줄인 이미지 기준 픽셀). 긴 변 2400px 이미지에서 약 25px 창에 해당한다. */
const ERASE_RADIUS = 3;
/** 배경을 부드럽게 하는 박스 블러 반경(줄인 이미지 기준 픽셀). 긴 변 2400px 이미지에서 약 51px 창에 해당한다. */
const SMOOTH_RADIUS = 6;
/** 배경 밝기는 종이 밝기(상위 5% 지점)의 이 비율 아래로 내려가지 않게 한다. 표의 짙은 머리글 칸을 그림자로 오인해 뿌옇게 만드는 것을 막는다. */
const MIN_BACKGROUND_RATIO = 0.8;

/** RGBA 픽셀을 밝기(0~255)로 바꾼다. 투명 픽셀은 흰색으로 본다. */
export function toGray(rgba: ArrayLike<number>, width: number, height: number): GrayImage {
  const data = new Uint8ClampedArray(width * height);
  for (let index = 0; index < data.length; index += 1) {
    const offset = index * 4;
    const alpha = (rgba[offset + 3] ?? 255) / 255;
    const luma = 0.299 * (rgba[offset] ?? 0) + 0.587 * (rgba[offset + 1] ?? 0) + 0.114 * (rgba[offset + 2] ?? 0);
    data[index] = luma * alpha + 255 * (1 - alpha);
  }
  return { data, width, height };
}

/** 칸 평균으로 줄인다. */
function shrink(gray: GrayImage, smallWidth: number, smallHeight: number): Float32Array {
  const { data, width, height } = gray;
  const sum = new Float32Array(smallWidth * smallHeight);
  const count = new Float32Array(smallWidth * smallHeight);
  const scaleX = smallWidth / width;
  const scaleY = smallHeight / height;
  for (let y = 0; y < height; y += 1) {
    const smallY = Math.min(smallHeight - 1, Math.floor(y * scaleY));
    for (let x = 0; x < width; x += 1) {
      const target = smallY * smallWidth + Math.min(smallWidth - 1, Math.floor(x * scaleX));
      sum[target] = (sum[target] ?? 0) + (data[y * width + x] ?? 0);
      count[target] = (count[target] ?? 0) + 1;
    }
  }
  for (let index = 0; index < sum.length; index += 1) sum[index] = (sum[index] ?? 0) / Math.max(1, count[index] ?? 1);
  return sum;
}

/** 가로·세로 순서로 적용하는 최대값 필터. */
function dilate(source: Float32Array, width: number, height: number, radius: number): Float32Array {
  const horizontal = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let best = 0;
      for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k += 1) best = Math.max(best, source[y * width + k] ?? 0);
      horizontal[y * width + x] = best;
    }
  }
  const result = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let best = 0;
      for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k += 1) best = Math.max(best, horizontal[k * width + x] ?? 0);
      result[y * width + x] = best;
    }
  }
  return result;
}

/** 가장자리는 있는 범위만 평균하는 박스 블러. */
function boxBlur(source: Float32Array, width: number, height: number, radius: number): Float32Array {
  const horizontal = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    let running = 0;
    let count = 0;
    for (let x = 0; x < Math.min(width, radius); x += 1) { running += source[y * width + x] ?? 0; count += 1; }
    for (let x = 0; x < width; x += 1) {
      const add = x + radius;
      if (add < width) { running += source[y * width + add] ?? 0; count += 1; }
      const drop = x - radius - 1;
      if (drop >= 0) { running -= source[y * width + drop] ?? 0; count -= 1; }
      horizontal[y * width + x] = running / count;
    }
  }
  const result = new Float32Array(source.length);
  for (let x = 0; x < width; x += 1) {
    let running = 0;
    let count = 0;
    for (let y = 0; y < Math.min(height, radius); y += 1) { running += horizontal[y * width + x] ?? 0; count += 1; }
    for (let y = 0; y < height; y += 1) {
      const add = y + radius;
      if (add < height) { running += horizontal[add * width + x] ?? 0; count += 1; }
      const drop = y - radius - 1;
      if (drop >= 0) { running -= horizontal[drop * width + x] ?? 0; count -= 1; }
      result[y * width + x] = running / count;
    }
  }
  return result;
}

/** 줄인 배경 지도에서 (x, y) 위치의 밝기를 쌍선형 보간으로 읽는다. 좌표는 원본 픽셀 기준이다. */
function sampleBackground(background: Float32Array, smallWidth: number, smallHeight: number, fx: number, fy: number): number {
  const x = Math.min(smallWidth - 1, Math.max(0, fx));
  const y = Math.min(smallHeight - 1, Math.max(0, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(smallWidth - 1, x0 + 1);
  const y1 = Math.min(smallHeight - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const top = (background[y0 * smallWidth + x0] ?? 0) * (1 - tx) + (background[y0 * smallWidth + x1] ?? 0) * tx;
  const bottom = (background[y1 * smallWidth + x0] ?? 0) * (1 - tx) + (background[y1 * smallWidth + x1] ?? 0) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** 값 배열에서 분위수(0~1) 값을 구한다. */
function percentile(values: Float32Array, ratio: number): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 255;
}

/** 조명 불균형을 없앤 밝기 이미지를 돌려준다. 입력은 바꾸지 않는다. */
export function flattenIllumination(gray: GrayImage): GrayImage {
  const { data, width, height } = gray;
  const output = new Uint8ClampedArray(data.length);
  if (width < 8 || height < 8) {
    output.set(data);
    return { data: output, width, height };
  }
  const scale = Math.min(1, BACKGROUND_LONG_SIDE / Math.max(width, height));
  const smallWidth = Math.max(2, Math.round(width * scale));
  const smallHeight = Math.max(2, Math.round(height * scale));
  const small = shrink(gray, smallWidth, smallHeight);
  const background = boxBlur(dilate(small, smallWidth, smallHeight, ERASE_RADIUS), smallWidth, smallHeight, SMOOTH_RADIUS);
  const paperLevel = percentile(background, 0.95);
  const floorLevel = paperLevel * MIN_BACKGROUND_RATIO;
  const ratioX = smallWidth / width;
  const ratioY = smallHeight / height;
  for (let y = 0; y < height; y += 1) {
    const fy = (y + 0.5) * ratioY - 0.5;
    for (let x = 0; x < width; x += 1) {
      const level = Math.max(floorLevel, sampleBackground(background, smallWidth, smallHeight, (x + 0.5) * ratioX - 0.5, fy));
      output[y * width + x] = (255 * (data[y * width + x] ?? 0)) / Math.max(1, level);
    }
  }
  return { data: output, width, height };
}
