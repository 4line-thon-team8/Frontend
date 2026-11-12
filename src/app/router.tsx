import { Route, Routes } from 'react-router';
import MobileLayout from '../layouts/MobileLayout';
import SplashPage from '../pages/auth/SplashPage';
import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import TermsPage from '../pages/auth/TermsPage';
import GradeInputPage from '../pages/grade/GradeInputPage';
import CameraPage from '../pages/grade/CameraPage';
import PdfUploadPage from '../pages/grade/PdfUploadPage';
import GradeConfirmPage from '../pages/grade/GradeConfirmPage';
import AnalysisLoadingPage from '../pages/grade/AnalysisLoadingPage';
import ReportSummaryPage from '../pages/report/ReportSummaryPage';
import StrategyPage from '../pages/report/StrategyPage';
import RecommendationPage from '../pages/report/RecommendationPage';
import MyPage from '../pages/mypage/MyPage';
import ReportListPage from '../pages/mypage/ReportListPage';
import ReportDetailPage from '../pages/mypage/ReportDetailPage';
import CameraErrorPage from '../pages/error/CameraErrorPage';
import AnalysisErrorPage from '../pages/error/AnalysisErrorPage';
import SessionExpiredPage from '../pages/error/SessionExpiredPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<MobileLayout />}>
        <Route path="/" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/terms" element={<TermsPage />} />
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
