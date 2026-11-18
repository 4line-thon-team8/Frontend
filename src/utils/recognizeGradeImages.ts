import type { ImageTextResult } from './extractImageText';
import type { ConfirmSubject } from '../types/gradeConfirm';
import { parseOcrGrades } from './parseOcrGrades';

export async function recognizeGradeImages(
  files: readonly File[],
  signal: AbortSignal,
  read: (file: File, index: number) => Promise<ImageTextResult>,
) {
  const subjects: ConfirmSubject[] = [];
  const texts: string[] = [];
  let failed = 0;
  let empty = 0;

  for (const [index, file] of files.entries()) {
    signal.throwIfAborted();
    let result: ImageTextResult;
    try {
      result = await read(file, index);
    } catch {
      signal.throwIfAborted();
      failed++;
      continue;
    }
    signal.throwIfAborted();
    texts.push(result.text);
    const rows = result.tableSubjects.length ? result.tableSubjects : parseOcrGrades(result.words);
    if (!rows.length) empty++;
    for (const row of rows) {
      subjects.push({ ...row, id: `ocr-${subjects.length + 1}` });
    }
  }
  return { subjects, text: texts.join('\n'), failed, empty };
}
