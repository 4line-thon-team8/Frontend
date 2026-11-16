import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SimulationResult, SimulationSubjectRow } from '../services/simulationApi';
import type { ConfirmSubject, GradeConfirmDraft } from '../types/gradeConfirm';
import type { NarrativeAnalysisResult } from '../utils/holistic/types';

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
  reset: () => void;
}

export const GradeAnalysisContext = createContext<GradeAnalysisState | null>(null);

export function useGradeAnalysis() {
  const state = useContext(GradeAnalysisContext);
  if (!state) throw new Error('GradeAnalysisProvider is required.');
  return state;
}
