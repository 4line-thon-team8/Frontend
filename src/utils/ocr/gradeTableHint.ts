/**
 * 인식한 글자가 성적표(교과학습발달상황)처럼 보이는지 가볍게 판별해요.
 * 표를 못 읽은 사진은 원본으로 한 번 더 인식하는데, 서술 페이지까지 두 번 읽으면 시간만 두 배가 되므로
 * 성적표처럼 보이는 사진에서만 두 번째 인식을 해요.
 * - '76/72.5(15.7)'처럼 원점수/과목평균 꼴의 줄이 2줄 이상이거나
 * - 표 머리글('단위수', '석차등급')이 읽혔으면 성적표로 봐요.
 */
const SCORE_LINE = /\d{1,3}\s*\/\s*\d{1,3}\s*[.,]\s*\d/u;
const TABLE_HEADER = /단\s*위\s*수|석\s*차\s*등\s*급/u;
const MIN_SCORE_LINES = 2;

export function looksLikeGradeTable(text: string): boolean {
  if (TABLE_HEADER.test(text)) return true;
  return text.split(/\r?\n/u).filter(line => SCORE_LINE.test(line)).length >= MIN_SCORE_LINES;
}
