import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import BottomNavigation from '../../components/common/BottomNavigation';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useGradeAnalysis } from '../../app/gradeAnalysisContext';
import {
  isNetworkError, isSessionExpiredError, logout, NETWORK_ERROR_MESSAGE, SESSION_EXPIRED_PATH, withdraw, WITHDRAW_CONFIRM, WITHDRAW_ERROR_MESSAGE,
} from '../../services/authApi';
import { clearAccessToken } from '../../services/authToken';
import {
  DELETE_REPORT_CONFIRM, deleteReport, formatReportDate, formatReportTime, getDeleteReportErrorMessage, getReports, NoTokenError,
} from '../../services/reportApi';
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
function formatReportCounts(counts: NonNullable<SavedReport['counts']>) {
  const tiers = APPLICATION_TIERS.filter(tier => (counts[tier] ?? 0) > 0);
  const total = tiers.reduce((sum, tier) => sum + (counts[tier] ?? 0), 0);
  return `추천 원서 ${total}장 · ${tiers.map(tier => `${TIER_LABELS[tier]} ${counts[tier]}`).join(' / ')}`;
}

type ReportCard = { id: string; createdAt: string; title: string; counts?: SavedReport['counts'] };

/**
 * 목록 API 는 reportId·createdAt 만 줘요. 학과 이름·구간별 장수는 명세에 없어서 생성 시각으로 제목을 대신합니다.
 * (목업 모드에서는 Figma 처럼 학과·장수까지 보여줘요.)
 */
function toReportCard(summary: { reportId: string; createdAt: string }): ReportCard {
  const mock = MOCK_SAVED_REPORTS.find(report => report.id === summary.reportId);
  return {
    id: summary.reportId,
    createdAt: formatReportDate(summary.createdAt),
    title: mock?.title ?? `${formatReportTime(summary.createdAt)} 생성`,
    counts: mock?.counts,
  };
}

export default function MyPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportCard[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [listError, setListError] = useState<string>();

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false; // 화면을 떠난 뒤 도착한 응답은 무시해요.
    getReports()
      .then(summaries => {
        if (ignore) return;
        setReports(summaries.map(toReportCard));
        setListState('ready');
      })
      .catch((error: unknown) => {
        if (ignore) return;
        // 토큰 없음·만료(401) → 세션 만료 화면 → 재로그인 후 마이페이지로 돌아와요.
        if (error instanceof NoTokenError || isSessionExpiredError(error)) {
          clearAccessToken();
          navigate(SESSION_EXPIRED_PATH, { replace: true, state: { from: '/mypage' } });
          return;
        }
        setListError(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : '저장된 리포트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
        setListState('error');
      });
    return () => { ignore = true; };
  }, [navigate, reloadKey]);

  const retryLoadReports = () => {
    setListState('loading');
    setReloadKey(key => key + 1);
  };

  const [deletingId, setDeletingId] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();

  const goSessionExpired = () => {
    clearAccessToken();
    navigate(SESSION_EXPIRED_PATH, { replace: true, state: { from: '/mypage' } });
  };

  /** 삭제 확인 창을 띄운 리포트 */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>();

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(undefined);
    if (deletingId) return; // 중복 클릭 방지
    setDeletingId(id);
    setDeleteError(undefined);
    try {
      await deleteReport(id);
      // 서버에서 지워진 뒤에만 목록에서 빼요.
      setReports(current => current.filter(report => report.id !== id));
    } catch (error) {
      if (error instanceof NoTokenError || isSessionExpiredError(error)) {
        goSessionExpired();
        return;
      }
      setDeleteError(getDeleteReportErrorMessage(error));
    } finally {
      setDeletingId(undefined);
    }
  };

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
          <li key={report.id} className="mypage-report-card">
            <h2>
              <Link to={`/mypage/reports/${report.id}`}>
                <span className="mypage-report-card__date">{report.createdAt}</span>
                {report.title}
              </Link>
            </h2>
            {report.counts && <p>{formatReportCounts(report.counts)}</p>}
            <button type="button" className="mypage-report-card__delete" onClick={() => setConfirmDeleteId(report.id)} disabled={deletingId !== undefined} aria-label={`${report.createdAt} 리포트 삭제`}>
              <TrashIcon />
              {deletingId === report.id ? '삭제 중…' : '삭제'}
            </button>
          </li>
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
        onConfirm={() => { if (confirmDeleteId) void handleDelete(confirmDeleteId); }}
        onCancel={() => setConfirmDeleteId(undefined)}
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
