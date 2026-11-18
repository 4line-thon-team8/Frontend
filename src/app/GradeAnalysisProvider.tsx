import { useCallback, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { createInitialGradeConfirmDraft } from '../pages/grade/gradeConfirm.mock';
import { GradeAnalysisContext } from './gradeAnalysisContext';
import type { GradeAnalysisSnapshot, ReportText } from './gradeAnalysisContext';
import { clearLastReport, loadLastReport, saveLastReport, type OwnedReport, type StoredReport } from '../pages/report/lastReportStorage';
import { getCurrentUserId } from '../services/authToken';
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
  const [ownedReport, setOwnedReport] = useState<OwnedReport | null>(loadLastReport);
  const lastReport = ownedReport?.report ?? null;
  /**
   * 총평·지원 전략 같은 리포트 문장. 브라우저 저장소에는 남기지 않고(기획 결정) 메모리에만 들고 있어요.
   * 그래서 홈·마이페이지를 다녀와도 보이고, 새로고침하면 사라져요.
   */
  const [lastReportText, setLastReportText] = useState<ReportText | null>(null);

  const setLastReport = useCallback((report: StoredReport, reportText: ReportText) => {
    setLastReportText(reportText);
    const userId = getCurrentUserId();
    if (!userId) {
      // 누구 것인지 모르면 브라우저에는 남기지 않고 이번 화면에서만 보여줘요.
      clearLastReport();
      setOwnedReport({ userId: '', report });
      return;
    }
    const owned = { userId, report };
    saveLastReport(owned);
    setOwnedReport(owned);
  }, []);

  /** 로그인 직후: 남은 리포트가 다른 계정(또는 주인을 모르는) 것이면 지워요. */
  const syncReportOwner = useCallback((userId: string | null) => {
    setOwnedReport(current => {
      if (!current || (userId && current.userId === userId)) return current;
      clearLastReport();
      setLastReportText(null);
      return null;
    });
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
    setOwnedReport(null);
    setLastReportText(null);
  }, [reset]);

  return (
    <GradeAnalysisContext.Provider value={{ lastReport, lastReportText, setLastReport, syncReportOwner, resetAll, narrative, setNarrative, draft, setDraft, snapshot, setSnapshot, reset, pendingOcrSubjects, setPendingOcrSubjects, hasConfirmedGrades, setHasConfirmedGrades, result, setResult }}>
      {children}
    </GradeAnalysisContext.Provider>
  );
}
