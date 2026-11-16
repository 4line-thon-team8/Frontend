import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import BottomNavigation from '../../components/common/BottomNavigation';
import { useGradeAnalysis } from '../../app/gradeAnalysisContext';
import {
  isNetworkError, isSessionExpiredError, logout, NETWORK_ERROR_MESSAGE, SESSION_EXPIRED_PATH, withdraw, WITHDRAW_CONFIRM, WITHDRAW_ERROR_MESSAGE,
} from '../../services/authApi';
import { clearAccessToken } from '../../services/authToken';
import { APPLICATION_TIERS, TIER_LABELS } from '../report/reportTier';
import { MOCK_SAVED_REPORTS, SYSTEM_RULES, type SavedReport } from './mypage.mock';
import './MyPage.css';

function TrashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 예: 추천 원서 4장 · 적정 2 / 도전 부담이 큰 후보 1 / 판단 자료 부족 1 (0장 구간은 빼요) */
function formatReportCounts(counts: SavedReport['counts']) {
  const tiers = APPLICATION_TIERS.filter(tier => (counts[tier] ?? 0) > 0);
  const total = tiers.reduce((sum, tier) => sum + (counts[tier] ?? 0), 0);
  return `추천 원서 ${total}장 · ${tiers.map(tier => `${TIER_LABELS[tier]} ${counts[tier]}`).join(' / ')}`;
}

export default function MyPage() {
  const navigate = useNavigate();
  // TODO: reportApi(GET /api/reports) 구현 후 실제 저장된 리포트로 교체합니다.
  const [reports, setReports] = useState(MOCK_SAVED_REPORTS);

  const handleDelete = (id: string) => {
    // TODO: DELETE /api/reports/{report_id} 연동 후 성공했을 때만 목록에서 지웁니다.
    setReports(current => current.filter(report => report.id !== id));
  };

  const { reset: resetGradeAnalysis } = useGradeAnalysis();
  const [loggingOut, setLoggingOut] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string>();

  const handleWithdraw = async () => {
    if (withdrawing || loggingOut) return; // 중복 클릭 방지
    if (!window.confirm(WITHDRAW_CONFIRM)) return;
    setWithdrawing(true);
    setWithdrawError(undefined);
    try {
      await withdraw();
      resetGradeAnalysis(); // 사용자별 화면 상태 정리
      navigate('/login', { replace: true });
    } catch (error) {
      setWithdrawing(false);
      // 401: 공통 인증 오류 → 세션 만료 화면 → 재로그인 후 마이페이지로 돌아와요.
      if (isSessionExpiredError(error)) {
        clearAccessToken();
        navigate(SESSION_EXPIRED_PATH, { replace: true, state: { from: '/mypage' } });
        return;
      }
      setWithdrawError(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : WITHDRAW_ERROR_MESSAGE);
    }
  };
  const [logoutError, setLogoutError] = useState<string>();

  const handleLogout = async () => {
    if (loggingOut) return; // 중복 클릭 방지
    setLoggingOut(true);
    setLogoutError(undefined);
    try {
      await logout();
      resetGradeAnalysis(); // 다음 사용자에게 입력값이 남지 않도록 화면 상태도 비워요.
      navigate('/login', { replace: true });
    } catch (error) {
      setLoggingOut(false);
      setLogoutError(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : '로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <div className="mypage-page">
      <header className="mypage-header">
        <p>마이페이지</p>
        <h1>저장된 리포트</h1>
      </header>

      <ul className="mypage-reports">
        {reports.map(report => (
          <li key={report.id} className="mypage-report-card">
            <h2>
              <Link to={`/mypage/reports/${report.id}`}>
                <span className="mypage-report-card__date">{report.createdAt}</span>
                {report.title}
              </Link>
            </h2>
            <p>{formatReportCounts(report.counts)}</p>
            <button type="button" className="mypage-report-card__delete" onClick={() => handleDelete(report.id)} aria-label={`${report.createdAt} 리포트 삭제`}>
              <TrashIcon />
              삭제
            </button>
          </li>
        ))}
      </ul>

      <Link className="mypage-add" to="/grade/input">+ 추가</Link>

      <hr className="mypage-divider" />

      <section className="mypage-rules" aria-labelledby="mypage-rules-title">
        <h2 id="mypage-rules-title">시스템 규칙</h2>
        <ul>
          {SYSTEM_RULES.map((rule, index) => (
            <li key={index}><strong>{rule.title}</strong> - {rule.description}</li>
          ))}
        </ul>
      </section>

      <button type="button" className="mypage-primary-button mypage-logout" onClick={() => void handleLogout()} disabled={loggingOut}>
        {loggingOut ? '로그아웃 중…' : '로그아웃'}
      </button>
      {logoutError && <p className="mypage-logout-error" role="alert">{logoutError}</p>}
      <p className="mypage-note">*회원 탈퇴 시 저장된 리포트가 모두 삭제돼요.</p>
      {/* TODO: Figma 에 탈퇴 버튼 디자인이 없어 임시로 작은 텍스트 버튼을 둡니다. */}
      <button type="button" className="mypage-withdraw" onClick={() => void handleWithdraw()} disabled={withdrawing || loggingOut}>
        {withdrawing ? '탈퇴 처리 중…' : '회원 탈퇴'}
      </button>
      {withdrawError && <p className="mypage-logout-error" role="alert">{withdrawError}</p>}

      <BottomNavigation />
    </div>
  );
}
