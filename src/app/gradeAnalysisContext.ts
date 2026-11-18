import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SimulationResult, SimulationSubjectRow } from '../services/simulationApi';
import type { ConfirmSubject, GradeConfirmDraft } from '../types/gradeConfirm';
import type { HolisticAnalysisPayload, NarrativeAnalysisResult } from '../utils/holistic/types';

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
  /** 서술 분석 결과(서버로 보낼 신호·근거 구절). 서술 전문은 저장하지 않아요. */
  narrative: NarrativeAnalysisResult | null;
  setNarrative: Dispatch<SetStateAction<NarrativeAnalysisResult | null>>;
  snapshot: GradeAnalysisSnapshot | null;
  setSnapshot: Dispatch<SetStateAction<GradeAnalysisSnapshot | null>>;
  /** 분석 응답 전체 (리포트 화면에서 사용). 새 분석을 시작하면 비워요. */
  result: SimulationResult | null;
  setResult: Dispatch<SetStateAction<SimulationResult | null>>;
  /**
   * 마지막으로 끝난 분석 (응답 + 그때 보낸 입력). 하단 '리포트' 탭이 이 값을 보여줘요.
   * 홈에서 새 입력을 시작해도(reset) 남아 있고, 새 분석이 끝나면 바뀌어요. 로그아웃·탈퇴(resetAll) 때만 비워요.
   */
  lastReport: LastReport | null;
  setLastReport: Dispatch<SetStateAction<LastReport | null>>;
  /** 입력 중인 분석만 비워요. 마지막 리포트는 남겨요. */
  reset: () => void;
  /** 마지막 리포트까지 모두 비워요 (로그아웃·탈퇴). */
  resetAll: () => void;
}

export interface LastReport {
  result: SimulationResult;
  snapshot: GradeAnalysisSnapshot;
}

export const GradeAnalysisContext = createContext<GradeAnalysisState | null>(null);

export function useGradeAnalysis() {
  const state = useContext(GradeAnalysisContext);
  if (!state) throw new Error('GradeAnalysisProvider is required.');
  return state;
}
