import { lazy, useEffect } from 'react';
import { Route, Routes } from 'react-router';
import MobileLayout from '../layouts/MobileLayout';
import SplashPage from '../pages/auth/SplashPage';

/**
 * 첫 화면(스플래시)만 번들에 넣고 나머지 페이지는 이동할 때 불러온다.
 * 화면이 뜬 뒤 브라우저가 한가할 때 나머지를 미리 받아 두어, 이동 시 기다리지 않게 한다.
 */
const pageLoaders = {
  LoginPage: () => import('../pages/auth/LoginPage'),
  SignupPage: () => import('../pages/auth/SignupPage'),
  TermsPage: () => import('../pages/auth/TermsPage'),
  PrivacyPage: () => import('../pages/auth/PrivacyPage'),
  GradeInputPage: () => import('../pages/grade/GradeInputPage'),
  CameraPage: () => import('../pages/grade/CameraPage'),
  PdfUploadPage: () => import('../pages/grade/PdfUploadPage'),
  GradeConfirmPage: () => import('../pages/grade/GradeConfirmPage'),
  AnalysisLoadingPage: () => import('../pages/grade/AnalysisLoadingPage'),
  ReportSummaryPage: () => import('../pages/report/ReportSummaryPage'),
  StrategyPage: () => import('../pages/report/StrategyPage'),
  RecommendationPage: () => import('../pages/report/RecommendationPage'),
  MyPage: () => import('../pages/mypage/MyPage'),
  ReportListPage: () => import('../pages/mypage/ReportListPage'),
  ReportDetailPage: () => import('../pages/mypage/ReportDetailPage'),
  CameraErrorPage: () => import('../pages/error/CameraErrorPage'),
  AnalysisErrorPage: () => import('../pages/error/AnalysisErrorPage'),
  SessionExpiredPage: () => import('../pages/error/SessionExpiredPage'),
};

const LoginPage = lazy(pageLoaders.LoginPage);
const SignupPage = lazy(pageLoaders.SignupPage);
const TermsPage = lazy(pageLoaders.TermsPage);
const PrivacyPage = lazy(pageLoaders.PrivacyPage);
const GradeInputPage = lazy(pageLoaders.GradeInputPage);
const CameraPage = lazy(pageLoaders.CameraPage);
const PdfUploadPage = lazy(pageLoaders.PdfUploadPage);
const GradeConfirmPage = lazy(pageLoaders.GradeConfirmPage);
const AnalysisLoadingPage = lazy(pageLoaders.AnalysisLoadingPage);
const ReportSummaryPage = lazy(pageLoaders.ReportSummaryPage);
const StrategyPage = lazy(pageLoaders.StrategyPage);
const RecommendationPage = lazy(pageLoaders.RecommendationPage);
const MyPage = lazy(pageLoaders.MyPage);
const ReportListPage = lazy(pageLoaders.ReportListPage);
const ReportDetailPage = lazy(pageLoaders.ReportDetailPage);
const CameraErrorPage = lazy(pageLoaders.CameraErrorPage);
const AnalysisErrorPage = lazy(pageLoaders.AnalysisErrorPage);
const SessionExpiredPage = lazy(pageLoaders.SessionExpiredPage);

function prefetchPagesWhenIdle(): () => void {
  const loaders = Object.values(pageLoaders);
  let cancelled = false;
  const run = () => {
    // 한꺼번에 받으면 첫 화면 요청과 경쟁하므로 하나씩 순서대로 받는다. 실패해도 이동할 때 다시 시도되므로 무시한다.
    void loaders.reduce<Promise<unknown>>(
      (chain, load) => chain.then(() => (cancelled ? undefined : load().catch(() => undefined))),
      Promise.resolve(),
    );
  };
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 4000 });
    return () => { cancelled = true; window.cancelIdleCallback(id); };
  }
  const id = window.setTimeout(run, 2000);
  return () => { cancelled = true; window.clearTimeout(id); };
}

export default function AppRouter() {
  useEffect(() => prefetchPagesWhenIdle(), []);
  return (
    <Routes>
      <Route element={<MobileLayout />}>
        <Route path="/" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/grade/input" element={<GradeInputPage />} />
        <Route path="/grade/camera" element={<CameraPage />} />
        <Route path="/grade/upload" element={<PdfUploadPage />} />
        <Route path="/grade/confirm" element={<GradeConfirmPage />} />
        <Route path="/grade/loading" element={<AnalysisLoadingPage />} />
        <Route path="/report/summary" element={<ReportSummaryPage />} />
        <Route path="/report/strategy" element={<StrategyPage />} />
        <Route path="/report/recommendations" element={<RecommendationPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/mypage/reports" element={<ReportListPage />} />
        <Route path="/mypage/reports/:reportId" element={<ReportDetailPage />} />
        <Route path="/error/camera" element={<CameraErrorPage />} />
        <Route path="/error/analysis" element={<AnalysisErrorPage />} />
        <Route path="/error/session-expired" element={<SessionExpiredPage />} />
        <Route path="*" element={<h1>페이지를 찾을 수 없어요.</h1>} />
      </Route>
    </Routes>
  );
}
