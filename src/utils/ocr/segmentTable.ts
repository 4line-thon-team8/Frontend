/**
 * 스캔 페이지에서 표의 칸을 찾아요. 의존성 없는 순수 함수라 워커와 테스트에서 똑같이 써요.
 *
 * 왜 필요한가: 페이지 전체를 한 번에 OCR하면 표의 라벨 칸·숫자 칸·서술 칸이 한 줄로 섞여 글자가 깨져요.
 * 표 선을 기준으로 칸을 잘라 칸마다 확대해서 읽으면 서술 인식률이 크게 올라가요.
 */
export type RegionKind =
  /** 서술이 들어 있는 칸(왼쪽 라벨 칸은 제외) */
  | 'narrative'
  /** 서술 칸 왼쪽의 라벨 칸(영역·시간 등) */
  | 'label'
  /** 오른쪽에도 세로선이 있는 성적표 같은 칸. 가로 전체를 읽어요. */
  | 'table'
  /** 세로선이 없는 칸 */
  | 'full'
  /** 표 밖이나 표 줄 사이에 남은 글자(제목·바닥글 등) */
  | 'gap';

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: RegionKind;
}

const INK_THRESHOLD = 150;
const MIN_BAND_HEIGHT = 70;
const MIN_VERTICAL_RUN = 60;
const MIN_GAP_HEIGHT = 30;

/** 연속으로 값이 이어진 위치들을 하나로 묶고 가운데 값만 돌려줘요. */
function groupPositions(positions: number[], gap: number): number[] {
  const groups: number[] = [];
  let start = -1;
  let previous = -1;
  for (const value of positions) {
    if (start < 0) start = previous = value;
    else if (value - previous <= gap) previous = value;
    else { groups.push(Math.floor((start + previous) / 2)); start = previous = value; }
  }
  if (start >= 0) groups.push(Math.floor((start + previous) / 2));
  return groups;
}

/** 가로로 minRun 이상 이어진 먹 픽셀만 남기고, 행마다 개수·좌우 끝을 돌려줘요(형태학 열기 연산과 같아요). */
function horizontalLines(ink: Uint8Array, width: number, height: number, minRun: number) {
  const mask = new Uint8Array(width * height);
  const counts = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let x = 0;
    while (x < width) {
      if (!ink[row + x]) { x++; continue; }
      let end = x;
      while (end < width && ink[row + end]) end++;
      if (end - x >= minRun) { mask.fill(1, row + x, row + end); counts[y] = (counts[y] ?? 0) + end - x; }
      x = end;
    }
  }
  return { mask, counts };
}

function verticalLines(ink: Uint8Array, width: number, height: number, minRun: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    let y = 0;
    while (y < height) {
      if (!ink[y * width + x]) { y++; continue; }
      let end = y;
      while (end < height && ink[end * width + x]) end++;
      if (end - y >= minRun) for (let k = y; k < end; k++) mask[k * width + x] = 1;
      y = end;
    }
  }
  return mask;
}

/**
 * gray: 0(검정)~255(흰색) 8비트 회색조 이미지. 표를 못 찾으면 null을 돌려줘요(호출한 쪽이 페이지 전체를 읽어요).
 * 돌려주는 칸은 위에서 아래 순서예요.
 */
export function segmentTable(gray: Uint8Array, width: number, height: number): Region[] | null {
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < ink.length; i++) ink[i] = (gray[i] ?? 255) < INK_THRESHOLD ? 1 : 0;

  const horizontal = horizontalLines(ink, width, height, Math.max(40, Math.floor(width / 5)));
  const rowCandidates: number[] = [];
  for (let y = 0; y < height; y++) if ((horizontal.counts[y] ?? 0) > width * 0.3) rowCandidates.push(y);
  const rowLines = groupPositions(rowCandidates, 4);
  if (rowLines.length < 3) return null;

  // 줄마다 좌우 끝을 구해요. 페이지 가장자리 전체를 가로지르는 줄(뷰어 테두리)은 표가 아니에요.
  const extents = rowLines.map(y => {
    let left = width;
    let right = -1;
    for (let yy = Math.max(0, y - 3); yy <= Math.min(height - 1, y + 3); yy++) {
      for (let x = 0; x < width; x++) if (horizontal.mask[yy * width + x]) { if (x < left) left = x; if (x > right) right = x; }
    }
    return { left, right };
  });
  const tolerance = width * 0.03;
  const candidates = extents.map((_, i) => i).filter(i => {
    const length = (extents[i]?.right ?? 0) - (extents[i]?.left ?? 0);
    return length < width * 0.97 && length > width * 0.3;
  });
  if (candidates.length === 0) return null;

  // 오른쪽 끝이 같은 줄이 가장 많은 묶음이 본문 표예요(바닥글 표·테두리와 구분).
  let bestIndex = candidates[0] ?? 0;
  let bestVotes = -1;
  for (const i of candidates) {
    const votes = candidates.filter(j => Math.abs((extents[j]?.right ?? 0) - (extents[i]?.right ?? 0)) < tolerance).length;
    if (votes > bestVotes) { bestVotes = votes; bestIndex = i; }
  }
  const tableRight = extents[bestIndex]?.right ?? 0;
  const selected = candidates.filter(i => Math.abs((extents[i]?.right ?? 0) - tableRight) < tolerance);
  const tableLeft = Math.min(...selected.map(i => extents[i]?.left ?? width));
  const tableWidth = tableRight - tableLeft;
  if (selected.length < 3 || tableWidth < width * 0.4) return null;
  const lines = selected.map(i => rowLines[i] ?? 0);

  const vertical = verticalLines(ink, width, height, MIN_VERTICAL_RUN);
  const regions: Region[] = [];
  const covered = new Uint8Array(height);

  for (let i = 0; i < lines.length - 1; i++) {
    const top = lines[i] ?? 0;
    const bottom = lines[i + 1] ?? 0;
    if (bottom - top <= MIN_BAND_HEIGHT) continue;
    const need = 0.85 * (bottom - top - 8);
    const xs: number[] = [];
    for (let x = tableLeft + 6; x < tableRight - 6; x++) {
      let sum = 0;
      for (let y = top + 4; y < bottom - 4; y++) sum += vertical[y * width + x] ?? 0;
      if (sum >= need) xs.push(x);
    }
    const dividers = groupPositions(xs, 6);
    const x0 = tableLeft + 3;
    const y0 = top + 3;
    const h = bottom - top - 6;
    if (dividers.length === 0) {
      regions.push({ x: x0, y: y0, width: tableRight - tableLeft - 6, height: h, kind: 'full' });
    } else if (dividers.every(x => x - tableLeft < tableWidth * 0.5) && (dividers[dividers.length - 1] ?? 0) - tableLeft > tableWidth * 0.1) {
      const split = (dividers[dividers.length - 1] ?? 0) + 3;
      regions.push({ x: x0, y: y0, width: split - x0 - 3, height: h, kind: 'label' });
      regions.push({ x: split, y: y0, width: tableRight - split - 3, height: h, kind: 'narrative' });
    } else {
      regions.push({ x: x0, y: y0, width: tableRight - tableLeft - 6, height: h, kind: 'table' });
    }
    covered.fill(1, Math.max(0, top - 2), Math.min(height, bottom + 3));
  }
  if (regions.length === 0) return null;

  // 칸 밖에 남은 글자(표 제목·머리줄 등)도 읽어요.
  const inkRow = new Uint8Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = tableLeft + 4; x < tableRight - 4; x++) sum += ink[y * width + x] ?? 0;
    inkRow[y] = sum > 2 ? 1 : 0;
  }
  const hasInkSoon = (from: number) => { for (let k = from; k < Math.min(height, from + 25); k++) if (inkRow[k]) return true; return false; };
  let y = 0;
  while (y < height) {
    if (inkRow[y] && !covered[y]) {
      const start = y;
      while (y < height && !covered[y] && (inkRow[y] || hasInkSoon(y))) y++;
      if (y - start >= MIN_GAP_HEIGHT) {
        const top = Math.max(0, start - 4);
        regions.push({ x: tableLeft, y: top, width: tableWidth, height: Math.min(height, y + 4) - top, kind: 'gap' });
      }
    } else y++;
  }
  return regions.sort((a, b) => a.y - b.y || a.x - b.x);
}
