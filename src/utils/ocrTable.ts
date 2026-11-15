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

export function detectOcrTables(width: number, height: number, dark: (x: number, y: number) => boolean, layered = false): Cell[][][] {
  const horizontal = lineCenters(height, y => {
    let count = 0;
    for (let x = 0; x < width; x++) if (dark(x, y)) count++;
    return count >= width * 0.65;
  });
  const tables: Cell[][][] = [];
  let rows: Cell[][] = [];
  let previous: number[] = [];
  let rowStart = 0;
  function finishTable() {
    if (rows.length < 2) return;
    if (layered) {
      const headerTop = horizontal[rowStart - 2];
      const headerBottom = horizontal[rowStart - 1];
      if (headerTop === undefined || headerBottom === undefined || headerBottom - headerTop < 20 ||
          headerBottom - headerTop > rows[0]![0]!.height * 3) return;
      const header = rows[0]!.map(cell => {
        const separators = lineCenters(headerBottom - headerTop, offset => {
          if (offset < 8 || offset > headerBottom - headerTop - 8) return false;
          let count = 0;
          for (let x = cell.left; x < cell.left + cell.width; x++) if (dark(x, headerTop + offset)) count++;
          return count >= cell.width * 0.85;
        });
        const top = headerTop + (separators.at(-1) ?? 0) + 4;
        return { ...cell, top, height: headerBottom - top - 4 };
      });
      if (header.every(cell => cell.height > 0)) tables.push([header, ...rows]);
    } else {
      tables.push(rows);
    }
  }
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
      finishTable();
      rows = [];
      rowStart = i;
    }
    previous = valid ? vertical : [];
    if (!valid) continue;
    const inset = Math.max(3, Math.round(rowHeight * 0.08));
    rows.push(vertical.slice(1).map((right, index) => ({
      left: vertical[index]! + inset, top: top + inset,
      width: right - vertical[index]! - 2 * inset, height: rowHeight - 2 * inset,
    })));
  }
  finishTable();
  return tables;
}

type CellReading = { text: string; confidence: number };
const compact = (text: string) => text.normalize('NFKC').replace(/\s/gu, '');

export async function recognizeOcrTable(tables: Cell[][][], read: (cell: Cell) => Promise<CellReading>, layered = false) {
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
    let grade = findUnique('석차등급');
    if (layered && grade < 0 && !labels.includes('석차등급')) {
      // The Korean model can read 등 as 동 in this small lower header.
      const variant = findUnique('석차동급');
      const achievement = findUnique('성취도');
      if (credits >= 0 && variant > credits && achievement === variant + 1 &&
          header[variant]?.top === header[achievement]?.top &&
          header[variant]!.top > header[credits]!.top) grade = variant;
    }
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
    const value = await read(gradeCell);
    const recognizedName = name.confidence >= 80 && /^[가-힣A-Za-z]/u.test(compact(name.text)) ? name.text.trim() : '';
    const recognizedGrade = value.confidence >= 80 ? compact(value.text).match(/^([1-5])(?:등급)?$/u)?.[1] ?? '' : '';
    if (!recognizedName && !recognizedGrade) continue;
    subjects.push({
      id: `ocr-${subjects.length + 1}`,
      name: recognizedName,
      grade: recognizedGrade,
    });
  }
  return subjects;
}
