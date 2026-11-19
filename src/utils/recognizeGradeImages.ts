import type { ImageTextResult } from './extractImageText';
import type { ConfirmSubject } from '../types/gradeConfirm';
import { parseOcrGrades } from './parseOcrGrades';
import { parseRecordGrades } from './parseRecordGrades';
import { identifySubject, snapSubjectName } from './subjectCatalog';

const isKnown2022Subject = (name: string) => identifySubject(name, '2022').status === 'identified';

/**
 * 격자(표 칸)와 단어 위치로 성적을 못 읽은 사진은, PDF와 같은 방식으로 인식한 글자 줄에서 읽어요.
 * 머리글이 깨져도 '76/72.5(15.7)' 같은 점수 조각을 기준점으로 삼아서 찍은 사진·모니터 화면처럼 표 선이 불안정한 경우에도 동작해요.
 */
function readRecordText(text: string): ConfirmSubject[] {
  return parseRecordGrades(text, isKnown2022Subject).map(subject => ({ ...subject, name: snapSubjectName(subject.name, '2022') }));
}

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
    const tableRows = result.tableSubjects.length ? result.tableSubjects : parseOcrGrades(result.words);
    const rows = tableRows.length ? tableRows : readRecordText(result.text);
    if (!rows.length) empty++;
    for (const row of rows) {
      subjects.push({ ...row, id: `ocr-${subjects.length + 1}` });
    }
  }
  return { subjects, text: texts.join('\n'), failed, empty };
}
