import type { ImageTextResult } from './extractImageText';
import type { ConfirmSubject } from '../types/gradeConfirm';
import { parseOcrGrades } from './parseOcrGrades';
import { parseRecordGrades } from './parseRecordGrades';
import { identifySubject, snapSubjectName } from './subjectCatalog';

const isKnown2022Subject = (name: string) => identifySubject(name, '2022').status === 'identified';

const MAX_CREDITS = 10;

/**
 * 점수 조각('76/72.5(15.7)')이 깨져 기준점을 못 찾은 줄을, 과목 사전에서 확인되는 과목명 + 단위수 + 줄 끝 등급으로 읽어요.
 * 과목명이 사전에서 확인될 때만 받아서 서술 문장을 성적 행으로 오인하지 않아요.
 * 등급은 수강자수 괄호 바로 뒤의 한 자리 숫자일 때만 읽고, 아니면 비워 둬서 확인 화면에서 고치게 해요.
 */
function readLooseRow(line: string): Pick<ConfirmSubject, 'name' | 'grade'> | null {
  const tokens = line.replace(/[|ㅣ｜]/gu, ' ').trim().split(/\s+/u);
  for (let index = 0; index < tokens.length - 2; index++) {
    if (!/^[가-힣]{2,}[1-2]?$/u.test(tokens[index]!)) continue;
    const name = snapSubjectName(tokens[index]!, '2022');
    if (identifySubject(name, '2022').status !== 'identified') continue;
    const credits = tokens[index + 1]!;
    if (!/^\d{1,2}$/u.test(credits) || Number(credits) < 1 || Number(credits) > MAX_CREDITS) continue;
    const rest = tokens.slice(index + 2);
    if (!rest.some(token => /[/)]/u.test(token))) continue;
    const grade = /^[1-9]$/u.test(rest.at(-1)!) && /\)/u.test(rest.at(-2) ?? '') ? rest.at(-1)! : '';
    return { name, grade };
  }
  return null;
}

/**
 * 두 번 인식한 결과를 합쳐요. 첫 번째 결과를 기준으로 두고, 두 번째에서만 읽힌 과목을 더하고,
 * 첫 번째에서 등급이 비어 있던 과목은 두 번째의 등급으로 채워요. 사전에서 확인되지 않는 이름은 중복이 생기지 않게 첫 번째 것만 써요.
 */
function mergeRecordRows(primary: ConfirmSubject[], secondary: ConfirmSubject[]): ConfirmSubject[] {
  const merged = [...primary];
  for (const row of secondary) {
    if (identifySubject(row.name, '2022').status !== 'identified') continue;
    const index = merged.findIndex(candidate => candidate.name === row.name);
    if (index < 0) merged.push(row);
    else if (!merged[index]!.grade && row.grade) merged[index] = { ...merged[index]!, grade: row.grade };
  }
  return merged;
}

/**
 * 격자(표 칸)와 단어 위치로 성적을 못 읽은 사진은, PDF와 같은 방식으로 인식한 글자 줄에서 읽어요.
 * 머리글이 깨져도 '76/72.5(15.7)' 같은 점수 조각을 기준점으로 삼아서 찍은 사진·모니터 화면처럼 표 선이 불안정한 경우에도 동작해요.
 * 점수 조각이 깨진 줄은 과목명과 단위수로 한 번 더 읽어요. 줄 순서(문서 순서)는 그대로 유지해요.
 */
function readRecordText(text: string): ConfirmSubject[] {
  const subjects: ConfirmSubject[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const [strict] = parseRecordGrades(line, isKnown2022Subject);
    const row = strict ? { name: snapSubjectName(strict.name, '2022'), grade: strict.grade } : readLooseRow(line);
    if (row) subjects.push({ id: `record-${subjects.length + 1}`, ...row });
  }
  return subjects;
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
    const rows = tableRows.length ? tableRows
      : result.altText ? mergeRecordRows(readRecordText(result.text), readRecordText(result.altText)) : readRecordText(result.text);
    if (!rows.length) empty++;
    for (const row of rows) {
      subjects.push({ ...row, id: `ocr-${subjects.length + 1}` });
    }
  }
  return { subjects, text: texts.join('\n'), failed, empty };
}
