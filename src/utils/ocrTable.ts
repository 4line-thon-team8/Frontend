export type Cell = { left: number; top: number; width: number; height: number };

function lineCenters(length: number, isLine: (index: number) => boolean) {
  const lines: number[] = [];
  let start = -1;
  for (let index = 0; index <= length; index++) {
    if (index < length && isLine(index)) {
      if (start < 0) start = index;
    } else if (start >= 0) {
      lines.push(Math.floor((start + index - 1) / 2));
      start = -1;
    }
  }
  return lines;
}

export function detectOcrTables(width: number, height: number, dark: (x: number, y: number) => boolean): Cell[][][] {
  const horizontal = lineCenters(height, y => {
    let count = 0;
    for (let x = 0; x < width; x++) if (dark(x, y)) count++;
    return count >= width * 0.65;
  });
  const tables: Cell[][][] = [];
  let rows: Cell[][] = [];
  let previous: number[] = [];
  for (let i = 1; i < horizontal.length; i++) {
    const top = horizontal[i - 1]!;
    const bottom = horizontal[i]!;
    const rowHeight = bottom - top;
    const vertical = rowHeight >= 16 ? lineCenters(width, x => {
      let count = 0;
      for (let y = top + 3; y < bottom - 3; y++) if (dark(x, y)) count++;
      return count >= (rowHeight - 6) * 0.9;
    }) : [];
    const valid = vertical.length >= 4 && vertical.length <= 12 &&
      vertical.slice(1).every((x, index) => x - vertical[index]! >= 20);
    if (!valid || previous.length !== vertical.length ||
        vertical.some((x, index) => Math.abs(x - previous[index]!) > 3)) {
      if (rows.length >= 2) tables.push(rows);
      rows = [];
    }
    previous = valid ? vertical : [];
    if (!valid) continue;
    const inset = Math.max(3, Math.round(rowHeight * 0.08));
    rows.push(vertical.slice(1).map((right, index) => ({
      left: vertical[index]! + inset, top: top + inset,
      width: right - vertical[index]! - 2 * inset, height: rowHeight - 2 * inset,
    })));
  }
  if (rows.length >= 2) tables.push(rows);
  return tables;
}

type CellReading = { text: string; confidence: number };
const compact = (text: string) => text.normalize('NFKC').replace(/\s/gu, '');

export async function recognizeOcrTable(tables: Cell[][][], read: (cell: Cell) => Promise<CellReading>) {
  const matches = [];
  if (tables.length > 8) return [];
  for (const [header, ...rows] of tables) {
    if (!header || rows.length > 30) continue;
    const labels: string[] = [];
    for (const cell of header) {
      const result = await read(cell);
      labels.push(result.confidence >= 80 ? compact(result.text) : '');
    }
    const findUnique = (label: string) => labels.indexOf(label) === labels.lastIndexOf(label) ? labels.indexOf(label) : -1;
    const subject = findUnique('과목명');
    const credits = findUnique('단위수');
    const grade = findUnique('석차등급');
    if (subject >= 0 && credits > subject && grade > credits) matches.push({ rows, subject, grade });
  }
  if (matches.length !== 1) return [];
  const { rows, subject, grade } = matches[0]!;
  const subjects = [];
  for (const row of rows) {
    const nameCell = row[subject];
    const gradeCell = row[grade];
    if (!nameCell || !gradeCell) continue;
    const name = await read(nameCell);
    // Preserve OCR punctuation for user review. The catalog gate still validates the edited name.
    if (name.confidence < 80 || !/^[가-힣]/u.test(compact(name.text))) continue;
    const value = await read(gradeCell);
    subjects.push({
      id: `ocr-${subjects.length + 1}`,
      name: name.text.trim(),
      grade: value.confidence >= 80 ? compact(value.text).match(/^([1-5])(?:등급)?$/u)?.[1] ?? '' : '',
    });
  }
  return subjects;
}
