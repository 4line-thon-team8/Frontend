import type { ConfirmSubject } from '../types/gradeConfirm';

// 학교생활기록부 '교과학습발달상황' 표의 한 행 예시:
//   국어   국어   4   90/63.5(14.0)   A(375)   1
//   교과   과목  단위수  원점수/과목평균(표준편차)  성취도(수강자수)  석차등급
// 표 선·머리글은 스캔 OCR에서 자주 깨지므로 머리글 대신, 거의 깨지지 않는
// '원점수/과목평균(표준편차)' 조각을 행의 기준점으로 삼아요.
// 여는 괄호는 OCR이 '0'이나 '['로 읽거나 빼먹는 일이 많아 있어도 없어도 받아줘요.
// OCR은 소수점을 '.' 대신 ','로, 또는 뒤에 공백을 붙여 읽는 일이 많아('75/73, 5(10, 0)') 둘 다 받아줘요.
const SCORE_PATTERN = /(\d{1,3})\s*\/\s*(\d{1,3}(?:\s?[.,]\s?\d)?)\s*[([0O]?\s*(\d{1,2}\s?[.,]\s?\d)\s*[)\]]/u;
// 기준점 바로 앞의 '과목명 + 단위수'. OCR이 칸 선을 '|'나 'ㅣ'로 읽는 경우를 허용해요.
// 칸 선이 'ㅣ', 'l', '｜' 같은 글자로 섞여 들어와도 과목명과 단위수를 이어서 읽어요.
// 2022 개정 과목명은 '공통국어1', '통합사회2'처럼 숫자로 끝나서, 과목명 끝의 1~2는 이름으로 봐요.
// 2015 개정 과목 '수학Ⅰ'의 로마 숫자는 OCR이 숫자 '1'로, 과목명과 띄어서 읽는 일이 많아('수학 1  4') 띄어 쓴 1~2도 이름으로 봐요.
// 뒤에 단위수가 따로 이어질 때만 이름으로 보므로, 단위수가 1인 행('과학탐구실험  1')은 그대로 단위수로 읽어요.
const SUBJECT_AND_CREDITS = /([가-힣A-Za-z·ㆍ]+(?:[1-2](?=[\s|ㅣlｌ｜]+\d)|\s+[1-2](?=[\s|ㅣlｌ｜]+\d)|(?:\s?[ⅠⅡI]{1,2}))?)[\s|ㅣlｌ｜,.]*(\d{1,2})[\s|ㅣlｌ｜]*$/u;
// 기준점 뒤 줄 끝의 한 자리 숫자가 석차등급. '(375)'처럼 수강자수 괄호 안의 숫자는 제외해요.
const TRAILING_GRADE = /(?<![\d(])([1-9])\s*$/u;
const MAX_CREDITS = 10;
// 단위수와 점수 사이에 OCR이 끼워 넣는 찌꺼기 글자('4  iy  76/72.5(15.7)')는 버려요.
const JUNK_BEFORE_SCORE = /[\s|ㅣlｌ｜]+[A-Za-z{([]{1,3}$/u;
// 수강자수 괄호 뒤에 홀로 남은 'i'·'l'·'|'는 1을 잘못 읽은 것으로 봐요. 괄호 없이 떠 있는 글자는 믿지 않아요.
const MISREAD_ONE = /\)\s*[iIl|!]\s*$/u;

/** 단어 사이 칸 선·공백. OCR이 칸 선을 'ㅣ'나 'l'로 읽는 경우도 받아요. */
const WORD_GAP = /[\s|ㅣlｌ｜]+/u;
const ROW_TAIL = /^(.*?)[\s|ㅣlｌ｜,.]+(\d{1,2})[\s|ㅣlｌ｜]*$/u;
/** 2022 개정 과목명 중 띄어 쓰는 이름('독서와 작문')은 몇 단어까지 이어 붙여 볼지. 가장 긴 이름('영어 독해와 작문')이 3단어예요. */
const MAX_NAME_WORDS = 4;

/** 과목 사전에 있는 이름인지. 사전(JSON)을 이 파일이 직접 읽지 않도록 호출하는 쪽에서 넘겨요. */
export type KnownSubject = (name: string) => boolean;

/**
 * '국어 독서와 작문 3'처럼 이름이 띄어 쓰여 있으면, 단위수 앞 단어들을 이어 붙여 과목 사전에 있는 이름을 찾아요.
 * 한 단어 이름은 아래 기본 규칙이 읽으므로, 두 단어 이상이면서 사전에 정확히 있는 경우만 다뤄요
 * (그러지 않으면 '독서와 작문'이 '작문'으로만 읽혀요). 사전에 없으면 null이라 기존 규칙으로 넘어가요.
 */
function readSpacedSubject(before: string, isKnownSubject: KnownSubject): { name: string; credits: number } | null {
  const tail = ROW_TAIL.exec(before);
  if (!tail) return null;
  const credits = Number(tail[2]);
  if (credits < 1 || credits > MAX_CREDITS) return null;
  const words = tail[1]!.split(WORD_GAP).filter(Boolean);
  for (let size = Math.min(MAX_NAME_WORDS, words.length); size >= 2; size -= 1) {
    const name = words.slice(-size).join('');
    if (isKnownSubject(name)) return { name, credits };
  }
  return null;
}

/** 한 줄이 성적 행이면 과목·등급을 돌려주고, 아니면 null이에요. 읽지 못한 칸은 빈 문자열로 둬요. */
function parseRecordLine(line: string, isKnownSubject: KnownSubject): Pick<ConfirmSubject, 'name' | 'grade'> | null {
  const score = SCORE_PATTERN.exec(line);
  if (!score) return null;

  const before = line.slice(0, score.index).trimEnd().replace(JUNK_BEFORE_SCORE, '');
  const after = line.slice(score.index + score[0].length).trim();
  const spaced = readSpacedSubject(before, isKnownSubject);
  const subject = spaced ? null : SUBJECT_AND_CREDITS.exec(before);
  const credits = spaced ? spaced.credits : subject ? Number(subject[2]) : 0;
  const name = spaced
    ? spaced.name
    : subject && credits >= 1 && credits <= MAX_CREDITS ? subject[1]!.replace(/\s+/gu, '') : '';
  const grade = TRAILING_GRADE.exec(after)?.[1] ?? (MISREAD_ONE.test(after) ? '1' : '');
  return { name, grade };
}

/**
 * 생기부 교과학습발달상황의 텍스트(PDF 글자 레이어 또는 OCR 결과)에서 과목별 석차등급을 읽어요.
 * - 과목명이나 등급을 읽지 못한 행도 빈 칸으로 남겨, 성적 확인 화면에서 사용자가 고치도록 해요.
 * - 등급이 없는 행(성취도만 있는 과목)은 grade가 빈 문자열이에요.
 * - isKnownSubject를 넘기면 '독서와 작문'처럼 띄어 쓴 과목명을 사전과 맞춰 한 과목으로 읽어요.
 */
export function parseRecordGrades(text: string, isKnownSubject: KnownSubject = () => false): ConfirmSubject[] {
  const subjects: ConfirmSubject[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const parsed = parseRecordLine(line, isKnownSubject);
    if (parsed) subjects.push({ id: `record-${subjects.length + 1}`, ...parsed });
  }
  return subjects;
}
