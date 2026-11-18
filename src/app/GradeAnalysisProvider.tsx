import { useCallback, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { createInitialGradeConfirmDraft } from '../pages/grade/gradeConfirm.mock';
import { GradeAnalysisContext } from './gradeAnalysisContext';
import type { GradeAnalysisSnapshot } from './gradeAnalysisContext';
import { clearLastReport, loadLastReport, saveLastReport, type StoredReport } from '../pages/report/lastReportStorage';
import type { ConfirmSubject } from '../types/gradeConfirm';
import type { SimulationResult } from '../services/simulationApi';
import { clearGradeImage } from '../utils/gradeImageStore';
import type { NarrativeAnalysisResult } from '../utils/holistic/types';

export default function GradeAnalysisProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(createInitialGradeConfirmDraft);
  const [hasConfirmedGrades, setHasConfirmedGrades] = useState(false);
  const [snapshot, setSnapshot] = useState<GradeAnalysisSnapshot | null>(null);
  const [pendingOcrSubjects, setPendingOcrSubjects] = useState<ConfirmSubject[] | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [narrative, setNarrative] = useState<NarrativeAnalysisResult | null>(null);
  const [lastReport, setLastReportState] = useState<StoredReport | null>(loadLastReport);
  const setLastReport = useCallback((report: StoredReport) => {
    saveLastReport(report);
    setLastReportState(report);
  }, []);

  const reset = useCallback(() => {
    clearGradeImage();
    setDraft(createInitialGradeConfirmDraft());
    setHasConfirmedGrades(false);
    setSnapshot(null);
    setPendingOcrSubjects(null);
    setResult(null);
    setNarrative(null);
  }, []);

  const resetAll = useCallback(() => {
    reset();
    clearLastReport();
    setLastReportState(null);
  }, [reset]);

  return (
    <GradeAnalysisContext.Provider value={{ lastReport, setLastReport, resetAll, narrative, setNarrative, draft, setDraft, snapshot, setSnapshot, reset, pendingOcrSubjects, setPendingOcrSubjects, hasConfirmedGrades, setHasConfirmedGrades, result, setResult }}>
      {children}
    </GradeAnalysisContext.Provider>
  );
}
