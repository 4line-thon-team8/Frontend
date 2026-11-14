import type { ConfirmSubject } from '../types/gradeConfirm';
import type { ImageTextWord } from './extractImageText';

const centerY = ({ bbox }: ImageTextWord) => (bbox.y0 + bbox.y1) / 2;
const height = ({ bbox }: ImageTextWord) => bbox.y1 - bbox.y0;
const compact = (text: string) => text.normalize('NFKC').replace(/\s/gu, '');
const MIN_CONFIDENCE = 80;
const TABLE_HEADERS = ['과목', '과목명', '단위수', '석차등급'];

function columnBoundary(left: ImageTextWord, right: ImageTextWord) {
  return (left.bbox.x1 + right.bbox.x0) / 2;
}

function combineHeaderFragments(row: ImageTextWord[]): ImageTextWord[] {
  const combined: ImageTextWord[] = [];
  for (let start = 0; start < row.length; start++) {
    const first = row[start];
    if (!first) continue;
    let text = compact(first.text);
    let match = first;
    let matchedEnd = start;
    let previous = first;
    let confidence = first.confidence;
    let y0 = first.bbox.y0;
    let y1 = first.bbox.y1;
    for (let end = start + 1; end < row.length; end++) {
      const next = row[end];
      if (!next) break;
      const height = Math.min(y1 - y0, next.bbox.y1 - next.bbox.y0);
      const overlap = Math.min(y1, next.bbox.y1) - Math.max(y0, next.bbox.y0);
      const gap = next.bbox.x0 - previous.bbox.x1;
      if (overlap < height / 2 || gap < -height / 4 || gap > height / 2 ||
          next.bbox.x1 <= previous.bbox.x1) break;
      text += compact(next.text);
      if (!TABLE_HEADERS.some(header => header.startsWith(text))) break;
      confidence = Math.min(confidence, next.confidence);
      y0 = Math.max(y0, next.bbox.y0);
      y1 = Math.min(y1, next.bbox.y1);
      previous = next;
      if (TABLE_HEADERS.includes(text)) {
        match = { text, confidence, bbox: { x0: first.bbox.x0, x1: next.bbox.x1, y0, y1 } };
        matchedEnd = end;
      }
    }
    combined.push(match);
    start = matchedEnd;
  }
  return combined;
}

export function parseOcrGrades(words: readonly ImageTextWord[]): ConfirmSubject[] {
  const rows: ImageTextWord[][] = [];
  for (const word of [...words].sort((a, b) => centerY(a) - centerY(b))) {
    const { bbox, confidence } = word;
    if (![bbox.x0, bbox.y0, bbox.x1, bbox.y1, confidence].every(Number.isFinite) ||
        bbox.x1 <= bbox.x0 || bbox.y1 <= bbox.y0 || !word.text.trim()) {
      continue;
    }
    const row = rows.at(-1);
    const anchor = row?.[0];
    if (anchor && row &&
        Math.min(anchor.bbox.y1, bbox.y1) - Math.max(anchor.bbox.y0, bbox.y0) >=
          Math.min(height(anchor), height(word)) / 2 &&
        Math.abs(centerY(anchor) - centerY(word)) <= Math.max(height(anchor), height(word)) / 2) {
      row.push(word);
    } else {
      rows.push([word]);
    }
  }

  for (const row of rows) row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const headers = rows.flatMap((wordsInRow, index) => {
    const row = combineHeaderFragments(wordsInRow);
    const subject = row.filter(word => ['과목', '과목명'].includes(compact(word.text)));
    const grade = row.filter(word => compact(word.text) === '석차등급');
    const credits = row.filter(word => compact(word.text) === '단위수');
    const [subjectWord] = subject;
    const [gradeWord] = grade;
    if (!subjectWord || !gradeWord || subject.length !== 1 || grade.length !== 1 ||
        Math.min(subjectWord.confidence, gradeWord.confidence) < MIN_CONFIDENCE ||
        subjectWord.bbox.x1 >= gradeWord.bbox.x0) {
      return [];
    }
    const [creditWord] = credits;
    if (!creditWord || credits.length !== 1 || creditWord.confidence < MIN_CONFIDENCE ||
        creditWord.bbox.x0 <= subjectWord.bbox.x1 || creditWord.bbox.x1 >= gradeWord.bbox.x0) {
      return [];
    }
    return [{ index, subject: subjectWord, credits: creditWord, grade: gradeWord, row }];
  });
  // Multiple headers may signal separate tables with different column boundaries.
  const [header] = headers;
  if (!header || headers.length !== 1) {
    return [];
  }
  const previousHeader = header.row[header.row.indexOf(header.subject) - 1];
  const nextHeader = header.row[header.row.indexOf(header.grade) + 1];
  // A reconstructed header can have a very short shared vertical box.
  // Use the tallest column label as the reference for the table's row spacing.
  const rowHeight = Math.max(height(header.subject), height(header.credits), height(header.grade));
  const subjectLeft = previousHeader ? columnBoundary(previousHeader, header.subject) : header.subject.bbox.x0;
  const subjectRight = columnBoundary(header.subject, header.credits);
  const gradeLeft = columnBoundary(header.credits, header.grade);
  const gradeRight = nextHeader && compact(nextHeader.text) === '비고' && nextHeader.bbox.x0 >= header.grade.bbox.x1
    ? columnBoundary(header.grade, nextHeader) : header.grade.bbox.x1;
  const candidates: ConfirmSubject[] = [];
  let previousY = centerY(header.subject);

  for (const row of rows.slice(header.index + 1)) {
    const [first] = row;
    if (!first || centerY(first) - previousY > rowHeight * 3) {
      break;
    }
    const names = row.filter(({ bbox }) => bbox.x0 >= subjectLeft && bbox.x1 <= subjectRight);
    if (!names.length) {
      continue;
    }
    const name = names.map(word => word.text.trim()).join(' ');
    if (!/^[가-힣][가-힣a-zA-Z0-9·ㆍ・]+$/u.test(compact(name)) ||
        names.some(word => word.confidence < MIN_CONFIDENCE)) {
      continue;
    }
    previousY = centerY(first);

    const grades = row.filter(({ bbox }) => bbox.x0 < gradeRight && bbox.x1 > gradeLeft);
    const grade = grades.length > 0 && grades.every(word =>
      word.confidence >= MIN_CONFIDENCE && word.bbox.x0 >= gradeLeft && word.bbox.x1 <= gradeRight)
      ? grades.map(word => compact(word.text)).join('').match(/^([1-5])(?:등급)?$/u)?.[1] ?? ''
      : '';
    candidates.push({ id: `ocr-${candidates.length + 1}`, name, grade });
  }
  return candidates;
}
