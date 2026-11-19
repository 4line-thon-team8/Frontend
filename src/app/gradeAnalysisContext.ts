import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SimulationResult, SimulationSubjectRow } from '../services/simulationApi';
import type { ConfirmSubject, GradeConfirmDraft } from '../types/gradeConfirm';
import type { HolisticAnalysisPayload, NarrativeAnalysisResult, NarrativeBlock } from '../utils/holistic/types';
import type { StoredReport } from '../pages/report/lastReportStorage';

/** 메모리에만 두는 리포트 부분: 총평·전략 등 문장 + 활동 요약·강점·학과별 조언 (브라우저 저장소에는 남기지 않아요) */
export type ReportText = Pick<SimulationResult, 'report' | 'holisticStrategy'>;

type AnalysisPreferences = Pick<
  GradeConfirmDraft,
  'majorIds' | 'admissions' | 'includeReach' | 'expandSimilarMajors'
>;

export interface GradeAnalysisSnapshot {
  subjects: readonly Readonly<SimulationSubjectRow>[];
  preferences: {
    readonly [Key in keyof AnalysisPreferences]: Readonly<AnalysisPreferences[Key]>;
  };
  /** 희망 학과 이름 (preferences.majorIds 와 같은 순서). 리포트 화면 표시용 */
  majorNames: readonly string[];
  /** 서술 분석 결과(신호·가린 구절). 읽지 않았거나 분석하지 못했으면 null. 서술 전문은 담지 않아요. */
  holisticAnalysis: HolisticAnalysisPayload | null;
  /** POST /api/simulations 중복 저장 방지 키. 같은 입력으로 다시 분석하면 같은 키를 써요. */
  idempotencyKey: string;
}

interface GradeAnalysisState {
  hasConfirmedGrades: boolean;
  setHasConfirmedGrades: Dispatch<SetStateAction<boolean>>;
  pendingOcrSubjects: ConfirmSubject[] | null;
  setPendingOcrSubjects: Dispatch<SetStateAction<ConfirmSubject[] | null>>;
  draft: GradeConfirmDraft;
  setDraft: Dispatch<SetStateAction<GradeConfirmDraft>>;
  /** 서술 분석 결과(서버로 보낼 신호·근거 구절). 서술 전문은 담지 않아요. 가장 최근 블록 기준이에요. */
  narrative: NarrativeAnalysisResult | null;
  /**
   * 확인 단계에서 고칠 수 있는 서술(영역×학년 블록). 메모리에만 두고 저장소·snapshot·서버에는 넣지 않아요.
   * 분석을 제출하거나(discardNarrativeText) 입력을 비우면(reset) 사라져요.
   */
  narrativeBlocks: readonly NarrativeBlock[] | null;
  /** 추출한 전문을 블록으로 나눠 담고 분석을 시작해요. null 이면 서술을 비워요. 기다리지 않아도 돼요(제출 때 resolveNarrative 가 기다려요). */
  loadNarrative: (fullText: string | null) => void;
  /** 서술 블록을 고쳐요. 잠시 뒤 고친 내용으로 다시 분석해요. 아직 서술이 없으면 아무 일도 하지 않아요. */
  editNarrativeBlocks: (update: (current: readonly NarrativeBlock[]) => readonly NarrativeBlock[]) => void;
  /** 가장 최근 블록 기준 분석이 끝나길 기다려 결과를 돌려줘요. 분석이 없었으면 null. 제출할 때 불러요. */
  resolveNarrative: () => Promise<NarrativeAnalysisResult | null>;
  /** 서술 문장(블록)만 지워요. 분석 결과(narrative)는 남겨 같은 입력으로 다시 제출할 수 있어요. */
  discardNarrativeText: () => void;
  snapshot: GradeAnalysisSnapshot | null;
  setSnapshot: Dispatch<SetStateAction<GradeAnalysisSnapshot | null>>;
  /** 분석 응답 전체 (리포트 화면에서 사용). 새 분석을 시작하면 비워요. */
  result: SimulationResult | null;
  setResult: Dispatch<SetStateAction<SimulationResult | null>>;
  /**
   * 마지막으로 끝난 분석의 추천 원서 목록·요약 카드 문구. 하단 '리포트' 탭이 이 값을 보여줘요.
   * 홈에서 새 입력을 시작해도(reset)·새로고침해도·로그아웃해도 남아 있고, 새 분석이 끝나면 바뀌어요.
   * 다른 계정으로 로그인하거나(syncReportOwner) 탈퇴하면(resetAll) 비워요.
   * 로그아웃 상태이거나 지금 로그인한 계정의 리포트가 아니면 null 로 보여요 (다른 사람이 보지 못하게).
   */
  lastReport: StoredReport | null;
  /** 마지막 리포트의 총평·지원 전략 문장과 활동 요약·강점·학과별 조언. 메모리에만 있어서 새로고침하면 null 이에요. */
  lastReportText: ReportText | null;
  /** 새 분석이 끝나면 불러요. 목록은 sessionStorage 에도 남기고, 문장(reportText)은 메모리에만 둬요. */
  setLastReport: (report: StoredReport, reportText: ReportText) => void;
  /** 로그인 직후 불러요. 남아 있는 리포트가 다른 계정(또는 주인을 모르는) 것이면 지워요. */
  syncReportOwner: (userId: string | null) => void;
  /** 입력 중인 분석만 비워요. 마지막 리포트는 남겨요 (로그아웃도 이것만 해요). */
  reset: () => void;
  /** 마지막 리포트까지 모두 비워요 (회원 탈퇴). */
  resetAll: () => void;
}

export const GradeAnalysisContext = createContext<GradeAnalysisState | null>(null);

export function useGradeAnalysis() {
  const state = useContext(GradeAnalysisContext);
  if (!state) throw new Error('GradeAnalysisProvider is required.');
  return state;
}
