import { shrink } from './flattenIllumination';
import type { GrayImage } from './flattenIllumination';

/**
 * 촬영한 성적표 사진이 글자 인식에 쓸 만한지 숫자로 잰다.
 * 기준값은 실제 생기부 촬영 샘플과, 같은 사진을 일부러 흐리거나 어둡게 만든 버전을 비교해 정했다.
 * 선명도 실측: 정상·어두운·저대비 사진 0.13~0.33, 약한 흐림 0.016~0.024(인식량 66~98%), 심한 흐림 0.002(인식 불가).
 * - 흐림이 가장 결정적이다: 선명도가 낮으면 인식이 거의 되지 않고, 조금 낮으면 일부 글자를 놓친다.
 * - 어두움과 낮은 대비는 인식기가 잘 버텨서, 종이가 아주 어두울 때만 문제로 본다.
 * 이 모듈은 코드(원인)만 돌려준다. 사용자에게 보여 줄 문구는 화면에서 정한다.
 */

export type ImageQualityIssue = 'BLURRY' | 'SOFT' | 'DARK' | 'LOW_CONTRAST';

export interface ImageQuality {
  /** 긴 변을 1000px로 맞춘 이미지의 라플라시안 분산을 대비의 제곱으로 나눈 값. 클수록 선명하고 밝기와 무관하다. */
  sharpness: number;
  /** 종이 밝기(밝기 분포 상위 10% 지점, 0~255). */
  paperLevel: number;
  /** 종이 밝기와 글자 밝기(하위 2% 지점)의 차이. */
  contrast: number;
  issues: ImageQualityIssue[];
}

export const QUALITY_THRESHOLDS = {
  blurry: 0.006,
  soft: 0.06,
  dark: 90,
  lowContrast: 30,
} as const;

const ANALYSIS_LONG_SIDE = 1000;

function laplacianVariance(values: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const response = (values[index - 1] ?? 0) + (values[index + 1] ?? 0) + (values[index - width] ?? 0) + (values[index + width] ?? 0) - 4 * (values[index] ?? 0);
      sum += response;
      sumSquares += response * response;
      count += 1;
    }
  }
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

function percentileLevel(values: Float32Array, ratio: number): number {
  const histogram = new Uint32Array(256);
  for (const value of values) {
    const level = Math.min(255, Math.max(0, Math.round(value)));
    histogram[level] = (histogram[level] ?? 0) + 1;
  }
  const target = values.length * ratio;
  let cumulative = 0;
  for (let level = 0; level < 256; level += 1) {
    cumulative += histogram[level] ?? 0;
    if (cumulative >= target) return level;
  }
  return 255;
}

export function assessImageQuality(gray: GrayImage): ImageQuality {
  const scale = Math.min(1, ANALYSIS_LONG_SIDE / Math.max(gray.width, gray.height));
  const width = Math.max(1, Math.round(gray.width * scale));
  const height = Math.max(1, Math.round(gray.height * scale));
  const values = shrink(gray, width, height);
  const paperLevel = percentileLevel(values, 0.9);
  const contrast = paperLevel - percentileLevel(values, 0.02);
  // 어둡거나 대비가 낮은 사진은 라플라시안 값도 같이 작아지므로, 대비의 제곱으로 나눠 밝기와 무관한 선명도로 만든다.
  const sharpness = laplacianVariance(values, width, height) / Math.max(1, contrast) ** 2;
  const issues: ImageQualityIssue[] = [];
  if (sharpness < QUALITY_THRESHOLDS.blurry) issues.push('BLURRY');
  else if (sharpness < QUALITY_THRESHOLDS.soft) issues.push('SOFT');
  if (paperLevel < QUALITY_THRESHOLDS.dark) issues.push('DARK');
  if (contrast < QUALITY_THRESHOLDS.lowContrast) issues.push('LOW_CONTRAST');
  return { sharpness, paperLevel, contrast, issues };
}
