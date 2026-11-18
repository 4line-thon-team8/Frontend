import bundled from '../../data/holistic/rules-0.7.0.json';
import type { HolisticRules, NarrativeSection } from './types';

/**
 * 앱에 포함해 둔 규칙 사전. 서버 파일(rules-0.7.0.json)을 그대로 복사한 것이라
 * 네트워크가 없어도 분석할 수 있다. 서버 규칙 사전을 받아오면 그쪽을 우선 쓴다.
 * 서버가 규칙을 바꾸면 이 파일도 같이 갱신한다.
 */
export const BUNDLED_RULES: HolisticRules = bundled as unknown as HolisticRules;

/**
 * 글자 사이 공백을 허용하는 정규식을 만든다.
 * 학교생활기록부 PDF는 표 머리글을 "세 부 능 력 및 특 기 사 항"처럼 글자마다 띄워서 찍는다.
 */
function spacedPattern(label: string): RegExp {
  const letters = [...label].filter(letter => letter !== ' ').join('\\s*');
  return new RegExp(letters.replace('\\s*및', '\\s*및?'), 'u');
}

/** 생기부 영역 제목. 서술 영역을 나누는 데만 쓰고 서버 규칙과는 무관하다. */
export const SECTION_HEADINGS: ReadonlyArray<readonly [NarrativeSection, RegExp]> = [
  ['autonomy', spacedPattern('자율활동')],
  ['club', spacedPattern('동아리활동')],
  ['career', spacedPattern('진로활동')],
  ['subject', new RegExp(`(${spacedPattern('세부능력및특기사항').source}|${spacedPattern('교과학습발달상황').source}|${spacedPattern('세특').source})`, 'u')],
  ['behavior', spacedPattern('행동특성및종합의견')],
];

export const SECTIONS: readonly NarrativeSection[] = ['autonomy', 'club', 'career', 'subject', 'behavior'];

/** 영역별 근거 구절 상한. 전체 상한(limits.evidenceMax) 안에서 한 영역이 독식하지 않게 한다. */
export const SECTION_EVIDENCE_CAP: Record<NarrativeSection, number> = {
  subject: 90,
  club: 24,
  career: 18,
  autonomy: 12,
  behavior: 6,
};

/**
 * 신호 품질(quality) 계산에 쓰는 FE 휴리스틱. 가설이라 서버가 수준을 정할 때
 * 이 값을 얼마나 반영할지는 서버가 정한다.
 */
export const INQUIRY_STAGES: readonly RegExp[] = [
  /(궁금|호기심|관심을?\s*(?:가지|갖)|문제의식|동기|계기|의문)/u,
  /(탐구|조사|실험|분석|설계|제작|구현|수행|진행)/u,
  /(결과|결론|도출|확인|입증|성과|개선했|제안했)/u,
  /(느꼈|깨달|한계|보완|후속|심화|성찰|반성)/u,
];

export const SPECIFIC_MARKERS = /(\d|『|』|「|」|python|java|excel|spss|r\s*언어|알고리즘|보고서|논문)/iu;
