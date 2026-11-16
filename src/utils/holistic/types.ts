/** 생기부 서술 영역. 서버 규칙 사전의 sections 값과 같은 이름을 쓴다. */
export type NarrativeSection = 'autonomy' | 'club' | 'career' | 'subject' | 'behavior';

export type NarrativeYear = 1 | 2 | 3;

/** 영역 × 학년 하나의 묶음. 분석 함수 안에서만 쓰고 밖으로 내보내지 않는다. */
export interface NarrativeBlock {
  section: NarrativeSection;
  year: NarrativeYear | null;
  /** 활동·과목 단위로 나눈 문단. 구절 배분(entry별 상한)의 단위. */
  entries: string[];
}

/* ---------- 규칙 사전 (GET /api/holistic-rules 응답과 같은 모양) ---------- */

export interface HolisticRuleLimits {
  evidenceMax: number;
  evidenceTextMaxChars: number;
  entryEvidenceMax: number;
  minNarrativeChars: number;
  indicatorSignalsMax: number;
  interestTagsMax: number;
  totalSectionCharsMax: number;
}

export interface HolisticRule {
  id: string;
  indicator: string;
  /** 이 규칙이 잡아내는 신호 유형. 근거 구절의 types 가 된다. */
  types: readonly string[];
  sections: readonly NarrativeSection[];
  /** 정규식 문자열. 플래그 없이 컴파일한다(서버 Java 정규식과 같은 결과를 내는 공통 구문만 사용). */
  pattern: string;
  within?: number | null;
  excludes: readonly string[];
}

export interface HolisticRules {
  rulesVersion: string;
  limits: HolisticRuleLimits;
  types: readonly string[];
  indicators: ReadonlyArray<{ id: string; label: string; element: string; sections: readonly string[] }>;
  rules: readonly HolisticRule[];
}

/* ---------- POST /api/simulations 의 holisticAnalysis ---------- */


export interface HolisticIndicatorSignal {
  id: string;
  count: number;
  years: NarrativeYear[];
  /** 구체성·탐구 단계 충족을 합친 0~1 값. 수준(1~5) 판단은 서버가 한다. */
  quality: number;
}

export interface HolisticInterestTag {
  tag: string;
  count: number;
  years: NarrativeYear[];
}

export interface HolisticEvidencePhrase {
  types: string[];
  /** 개인정보를 가린 짧은 구절. 서술 원문 전체가 아니다. */
  text: string;
  year: NarrativeYear | null;
  section: NarrativeSection;
}

export interface HolisticAnalysisPayload {
  rulesVersion: string;
  coverage: {
    sectionChars: Record<NarrativeSection, number>;
    years: NarrativeYear[];
  };
  indicatorSignals: HolisticIndicatorSignal[];
  interestTags: HolisticInterestTag[];
  evidence: HolisticEvidencePhrase[];
}

/** 서술이 부족하거나 구분에 실패하면 이유를 돌려 화면이 문구를 고르게 한다. */
export type NarrativeAnalysisResult =
  | { ok: true; payload: HolisticAnalysisPayload }
  | { ok: false; reason: 'too-short' | 'no-sections' };

/** 전공 키워드 사전(GET /api/tag-map)의 한 줄 */
export interface TagKeyword {
  keyword: string;
  tag: string;
}
