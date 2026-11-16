import { useCallback, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { createInitialGradeConfirmDraft } from '../pages/grade/gradeConfirm.mock';
import { GradeAnalysisContext } from './gradeAnalysisContext';
import type { GradeAnalysisSnapshot } from './gradeAnalysisContext';
import type { ConfirmSubject } from '../types/gradeConfirm';
import type { SimulationResult } from '../services/simulationApi';
import { clearGradeImage } from '../utils/gradeImageStore';

export default function GradeAnalysisProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(createInitialGradeConfirmDraft);
  const [hasConfirmedGrades, setHasConfirmedGrades] = useState(false);
  const [snapshot, setSnapshot] = useState<GradeAnalysisSnapshot | null>(null);
  const [pendingOcrSubjects, setPendingOcrSubjects] = useState<ConfirmSubject[] | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const reset = useCallback(() => {
    clearGradeImage();
    setDraft(createInitialGradeConfirmDraft());
    setHasConfirmedGrades(false);
    setSnapshot(null);
    setPendingOcrSubjects(null);
    setResult(null);
  }, []);

  return (
    <GradeAnalysisContext.Provider value={{ draft, setDraft, snapshot, setSnapshot, reset, pendingOcrSubjects, setPendingOcrSubjects, hasConfirmedGrades, setHasConfirmedGrades, result, setResult }}>
      {children}
    </GradeAnalysisContext.Provider>
  );
}
