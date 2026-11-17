import type { ConfirmSubject } from '../types/gradeConfirm';

// 학교생활기록부 '교과학습발달상황' 표의 한 행 예시:
//   국어   국어   4   90/63.5(14.0)   A(375)   1
//   교과   과목  단위수  원점수/과목평균(표준편차)  성취도(수강자수)  석차등급
// 표 선·머리글은 스캔 OCR에서 자주 깨지므로 머리글 대신, 거의 깨지지 않는
// '원점수/과목평균(표준편차)' 조각을 행의 기준점으로 삼아요.
// 여는 괄호는 OCR이 '0'이나 '['로 읽거나 빼먹는 일이 많아 있어도 없어도 받아줘요.
const SCORE_PATTERN = /(\d{1,3})\s*\/\s*(\d{1,3}(?:\.\d)?)\s*[([0O]?\s*(\d{1,2}\.\d)\s*[)\]]/u;
// 기준점 바로 앞의 '과목명 + 단위수'. OCR이 칸 선을 '|'나 'ㅣ'로 읽는 경우를 허용해요.
// 칸 선이 'ㅣ', 'l', '｜' 같은 글자로 섞여 들어와도 과목명과 단위수를 이어서 읽어요.
// 2022 개정 과목명은 '공통국어1', '통합사회2'처럼 숫자로 끝나서, 과목명 끝의 1~2는 이름으로 봐요.
const SUBJECT_AND_CREDITS = /([가-힣A-Za-z·ㆍ]+(?:[1-2](?=[\s|ㅣlｌ｜]+\d)|(?:\s?[ⅠⅡI]{1,2}))?)[\s|ㅣlｌ｜,.]*(\d{1,2})[\s|ㅣlｌ｜]*$/u;
// 기준점 뒤 줄 끝의 한 자리 숫자가 석차등급. '(375)'처럼 수강자수 괄호 안의 숫자는 제외해요.
const TRAILING_GRADE = /(?<![\d(])([1-9])\s*$/u;
const MAX_CREDITS = 10;

/** 한 줄이 성적 행이면 과목·등급을 돌려주고, 아니면 null이에요. 읽지 못한 칸은 빈 문자열로 둬요. */
function parseRecordLine(line: string): Pick<ConfirmSubject, 'name' | 'grade'> | null {
  const score = SCORE_PATTERN.exec(line);
  if (!score) return null;

  const before = line.slice(0, score.index).trimEnd();
  const after = line.slice(score.index + score[0].length).trim();
  const subject = SUBJECT_AND_CREDITS.exec(before);
  const credits = subject ? Number(subject[2]) : 0;
  const name = subject && credits >= 1 && credits <= MAX_CREDITS ? subject[1]!.replace(/\s+/gu, '') : '';
  const grade = TRAILING_GRADE.exec(after)?.[1] ?? '';
  return { name, grade };
}

/**
 * 생기부 교과학습발달상황의 텍스트(PDF 글자 레이어 또는 OCR 결과)에서 과목별 석차등급을 읽어요.
 * - 과목명이나 등급을 읽지 못한 행도 빈 칸으로 남겨, 성적 확인 화면에서 사용자가 고치도록 해요.
 * - 등급이 없는 행(성취도만 있는 과목)은 grade가 빈 문자열이에요.
 */
export function parseRecordGrades(text: string): ConfirmSubject[] {
  const subjects: ConfirmSubject[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const parsed = parseRecordLine(line);
    if (parsed) subjects.push({ id: `record-${subjects.length + 1}`, ...parsed });
  }
  return subjects;
}
