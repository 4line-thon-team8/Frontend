/**
 * OCR이 만든 글에서 서술이 아닌 찌꺼기를 걷어내요.
 * 표 선이 글자로 읽힌 줄("|", "ㅣ", "_ _ _")이나, 한글·숫자·영문이 하나도 없는 줄을 지워요.
 */
const MEANINGFUL = /[가-힣A-Za-z0-9]/u;
/** 문서 확인 번호 줄과 쪽 바닥글의 "반/번호/이름" 칸에는 신청인·학생 이름이 들어 있어서 서술과 함께 보관하지 않아요. */
const IDENTITY_LINE = /문서\s*확인\s*번호|신청인|반\s.*번호\s.*이름/u;

export function cleanOcrText(text: string): string {
  return text
    .normalize('NFKC')
    .split(/\r?\n/u)
    .map(line => line.replace(/[\u1100-\u11FF]/gu, '').replace(/[|｜ㅣ_]{1,}(?=\s|$)/gu, ' ').replace(/[ \t]+/gu, ' ').trim())
    .filter((line, index, lines) => line === '' ? lines[index - 1] !== '' : MEANINGFUL.test(line) && !IDENTITY_LINE.test(line))
    .join('\n')
    .trim();
}

/** 라벨 칸(학년·영역·시간)은 여러 줄로 나뉘어 읽히므로 한 줄로 합쳐요: "자율\n활동\n34" → "자율 활동 34" */
export function joinLabelLines(text: string): string {
  return cleanOcrText(text).split('\n').filter(Boolean).join(' ');
}
