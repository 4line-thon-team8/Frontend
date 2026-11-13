import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SimulationSubjectRow } from '../services/simulationApi';
import type { GradeConfirmDraft } from '../types/gradeConfirm';

type AnalysisPreferences = Pick<
  GradeConfirmDraft,
  'majorIds' | 'admissions' | 'includeReach' | 'expandSimilarMajors'
>;

export interface GradeAnalysisSnapshot {
  subjects: readonly Readonly<SimulationSubjectRow>[];
  preferences: {
    readonly [Key in keyof AnalysisPreferences]: Readonly<AnalysisPreferences[Key]>;
  };
}

interface GradeAnalysisState {
  draft: GradeConfirmDraft;
  setDraft: Dispatch<SetStateAction<GradeConfirmDraft>>;
  snapshot: GradeAnalysisSnapshot | null;
  setSnapshot: Dispatch<SetStateAction<GradeAnalysisSnapshot | null>>;
  reset: () => void;
}

export const GradeAnalysisContext = createContext<GradeAnalysisState | null>(null);

export function useGradeAnalysis() {
  const state = useContext(GradeAnalysisContext);
  if (!state) throw new Error('GradeAnalysisProvider is required.');
  return state;
}
