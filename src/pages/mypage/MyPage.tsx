import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import BottomNavigation from '../../components/common/BottomNavigation';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useGradeAnalysis } from '../../app/gradeAnalysisContext';
import {
  isNetworkError, isSessionExpiredError, logout, NETWORK_ERROR_MESSAGE, SESSION_EXPIRED_PATH, withdraw, WITHDRAW_CONFIRM, WITHDRAW_ERROR_MESSAGE,
} from '../../services/authApi';
import { clearAccessToken } from '../../services/authToken';
import { DELETE_REPORT_CONFIRM } from '../../services/reportApi';
import { SYSTEM_RULES } from './mypage.mock';
import SavedReportCard from './SavedReportCard';
import { useSavedReports } from './useSavedReports';
import './MyPage.css';

export default function MyPage() {
  const navigate = useNavigate();
  const goSessionExpired = useCallback(() => {
    clearAccessToken();
    navigate(SESSION_EXPIRED_PATH, { replace: true, state: { from: '/mypage' } });
  }, [navigate]);
  const {
    reports, listState, listError, reload: retryLoadReports,
    deletingId, deleteError, confirmDeleteId, requestDelete, cancelDelete, confirmDelete,
  } = useSavedReports(goSessionExpired);

  const { reset: resetGradeAnalysis } = useGradeAnalysis();
  const [loggingOut, setLoggingOut] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string>();

  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);

  const handleWithdraw = async () => {
    setConfirmWithdrawOpen(false);
    if (withdrawing || loggingOut) return; // 중복 클릭 방지
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

      {listState === 'loading' && <p className="mypage-reports-status" role="status">저장된 리포트를 불러오고 있어요.</p>}
      {listState === 'error' && (
        <div className="mypage-reports-status" role="alert">
          <p>{listError}</p>
          <button type="button" className="mypage-reports-retry" onClick={retryLoadReports}>다시 불러오기</button>
        </div>
      )}
      {listState === 'ready' && reports.length === 0 && (
        <p className="mypage-reports-status">아직 저장된 리포트가 없어요.<br />성적을 입력하고 분석하면 자동으로 저장돼요.</p>
      )}

      {deleteError && <p className="mypage-reports-status mypage-reports-status--error" role="alert">{deleteError}</p>}

      <ul className="mypage-reports">
        {reports.map(report => (
          <SavedReportCard
            key={report.id}
            report={report}
            deleting={deletingId === report.id}
            deleteDisabled={deletingId !== undefined}
            onDelete={() => requestDelete(report.id)}
          />
        ))}
      </ul>

      <Link className="mypage-add" to="/grade/input">리포트 만들러가기</Link>

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
      <button type="button" className="mypage-withdraw" onClick={() => setConfirmWithdrawOpen(true)} disabled={withdrawing || loggingOut}>
        {withdrawing ? '탈퇴 처리 중…' : '회원 탈퇴'}
      </button>
      {withdrawError && <p className="mypage-logout-error" role="alert">{withdrawError}</p>}

      <ConfirmDialog
        open={confirmDeleteId !== undefined}
        {...DELETE_REPORT_CONFIRM}
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDelete}
      />

      <ConfirmDialog
        open={confirmWithdrawOpen}
        {...WITHDRAW_CONFIRM}
        destructive
        onConfirm={() => void handleWithdraw()}
        onCancel={() => setConfirmWithdrawOpen(false)}
      />

      <BottomNavigation />
    </div>
  );
}
