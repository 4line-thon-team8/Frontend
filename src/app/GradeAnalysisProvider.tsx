import { useCallback, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { createInitialGradeConfirmDraft } from '../pages/grade/gradeConfirm.mock';
import { GradeAnalysisContext } from './gradeAnalysisContext';
import type { GradeAnalysisSnapshot, ReportText } from './gradeAnalysisContext';
import { clearLastReport, loadLastReport, saveLastReport, type OwnedReport, type StoredReport } from '../pages/report/lastReportStorage';
import { getCurrentUserId } from '../services/authToken';
import type { ConfirmSubject } from '../types/gradeConfirm';
import type { SimulationResult } from '../services/simulationApi';
import { clearGradeImage } from '../utils/gradeImageStore';
import { analyzeBlocksWithBundledModel } from '../utils/holistic/analyzeNarrative';
import { createNarrativeSession } from '../utils/holistic/narrativeSession';
import type { NarrativeSessionState } from '../utils/holistic/narrativeSession';
import { loadTagKeywords } from '../utils/holistic/tagKeywords';

export default function GradeAnalysisProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(createInitialGradeConfirmDraft);
  const [hasConfirmedGrades, setHasConfirmedGrades] = useState(false);
  const [snapshot, setSnapshot] = useState<GradeAnalysisSnapshot | null>(null);
  const [pendingOcrSubjects, setPendingOcrSubjects] = useState<ConfirmSubject[] | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  // 확인 단계의 서술(블록)과 분석 결과. 블록은 메모리에만 두고, 로직은 narrativeSession 이 맡아요.
  const [narrativeState, setNarrativeState] = useState<NarrativeSessionState>({ blocks: null, result: null });
  const [narrativeSession] = useState(() => createNarrativeSession({
    analyze: async blocks => analyzeBlocksWithBundledModel(blocks, { tagKeywords: await loadTagKeywords() }),
    onChange: setNarrativeState,
  }));
  useEffect(() => () => narrativeSession.dispose(), [narrativeSession]);
  const [ownedReport, setOwnedReport] = useState<OwnedReport | null>(loadLastReport);
  // 로그아웃해도 리포트는 남겨 두지만, 지금 로그인한 계정의 것일 때만 보여줘요.
  // (토큰은 메모리에만 있어서 렌더할 때마다 읽어요. 로그인·로그아웃 뒤에는 화면 이동으로 다시 그려져요.)
  const currentUserId = getCurrentUserId();
  const isOwnerSignedIn = ownedReport !== null && currentUserId !== null && ownedReport.userId === currentUserId;
  const lastReport = isOwnerSignedIn ? ownedReport.report : null;
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

  // 로그인 직후 lastReport(토큰 기준)를 다시 계산하도록 Provider 를 다시 그리는 용도예요.
  const [, setSignInCount] = useState(0);

  /** 로그인 직후: 남은 리포트가 다른 계정(또는 주인을 모르는) 것이면 지우고, 같은 계정이면 다시 보여줘요. */
  const syncReportOwner = useCallback((userId: string | null) => {
    setSignInCount(count => count + 1);
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
    narrativeSession.reset();
  }, [narrativeSession]);

  const resetAll = useCallback(() => {
    reset();
    clearLastReport();
    setOwnedReport(null);
    setLastReportText(null);
  }, [reset]);

  return (
    <GradeAnalysisContext.Provider value={{ lastReport, lastReportText: lastReport ? lastReportText : null, setLastReport, syncReportOwner, resetAll, narrative: narrativeState.result, narrativeBlocks: narrativeState.blocks, loadNarrative: narrativeSession.load, editNarrativeBlocks: narrativeSession.edit, resolveNarrative: narrativeSession.resolve, discardNarrativeText: narrativeSession.discardText, draft, setDraft, snapshot, setSnapshot, reset, pendingOcrSubjects, setPendingOcrSubjects, hasConfirmedGrades, setHasConfirmedGrades, result, setResult }}>
      {children}
    </GradeAnalysisContext.Provider>
  );
}
