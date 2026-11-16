import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { isSessionExpiredError, SESSION_EXPIRED_PATH } from '../../services/authApi';
import { clearAccessToken } from '../../services/authToken';
import {
  DELETE_REPORT_CONFIRM, deleteReport, formatReportDate, getDeleteReportErrorMessage, getReport, getReportErrorMessage, NoTokenError,
  type SavedReportDetail,
} from '../../services/reportApi';
import BottomNavigation from '../../components/common/BottomNavigation';
import arrowBack from '../../assets/icons/arrow-back.svg';
import { APPLICATION_TIERS, TIER_LABELS, tierClassName, type ApplicationTier } from '../report/reportTier';
import './MyPage.css';

function isApplicationTier(value: string): value is ApplicationTier {
  return (APPLICATION_TIERS as readonly string[]).includes(value);
}

/** 구분 라벨: 형식 미정이라 구간 코드(SAFE 등)면 한글 라벨로, 그 외 문자열은 그대로, 없으면 숨겨요. */
function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  if (isApplicationTier(category)) {
    return <span className={`mypage-detail-row__tier ${tierClassName(category)}`}>{TIER_LABELS[category]}</span>;
  }
  return <span className="mypage-detail-row__tier is-unrated">{category}</span>;
}

export default function ReportDetailPage() {
  const navigate = useNavigate();
  const { reportId } = useParams();
  const [report, setReport] = useState<SavedReportDetail>();
  const [loadError, setLoadError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!reportId) return;
    let ignore = false; // 화면을 떠난 뒤 도착한 응답은 무시해요.
    getReport(reportId)
      .then(detail => {
        if (!ignore) setReport(detail);
      })
      .catch((error: unknown) => {
        if (ignore) return;
        // 토큰 없음·만료(401) → 세션 만료 화면 → 재로그인 후 이 상세 화면으로 돌아와요.
        if (error instanceof NoTokenError || isSessionExpiredError(error)) {
          clearAccessToken();
          navigate(SESSION_EXPIRED_PATH, { replace: true, state: { from: `/mypage/reports/${reportId}` } });
          return;
        }
        setLoadError(getReportErrorMessage(error));
      });
    return () => { ignore = true; };
  }, [navigate, reportId, reloadKey]);

  const retryLoad = () => {
    setLoadError(undefined);
    setReloadKey(key => key + 1);
  };

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  const handleDelete = async () => {
    if (!reportId || deleting) return;
    if (!window.confirm(DELETE_REPORT_CONFIRM)) return;
    setDeleting(true);
    setDeleteError(undefined);
    try {
      await deleteReport(reportId);
      // 서버에서 지워진 뒤에만 목록으로 돌아가요.
      navigate('/mypage', { replace: true });
    } catch (error) {
      if (error instanceof NoTokenError || isSessionExpiredError(error)) {
        clearAccessToken();
        navigate(SESSION_EXPIRED_PATH, { replace: true, state: { from: `/mypage/reports/${reportId}` } });
        return;
      }
      setDeleting(false);
      setDeleteError(getDeleteReportErrorMessage(error));
    }
  };

  return (
    <div className="mypage-page mypage-page--detail">
      <Link className="mypage-back" to="/mypage" aria-label="마이페이지로 돌아가기">
        <img src={arrowBack} alt="" width="29" height="29" />
      </Link>

      <h1 className="mypage-detail-title">리포트 상세</h1>

      {!report && !loadError && <p className="mypage-reports-status" role="status">리포트를 불러오고 있어요.</p>}

      {loadError && (
        <div className="mypage-reports-status" role="alert">
          <p>{loadError}</p>
          <button type="button" className="mypage-reports-retry" onClick={retryLoad}>다시 불러오기</button>
        </div>
      )}

      {report && !loadError && (
        <>
          <p className="mypage-detail-created">{formatReportDate(report.createdAt)} 생성</p>

          <ol className="mypage-detail-list">
            {report.recommendations.map(item => (
              <li key={`${item.rank}-${item.university}-${item.department}`} className="mypage-detail-row">
                <span className="mypage-detail-row__rank">{item.rank}지망</span>
                <span className="mypage-detail-row__name">
                  {item.university} {item.department}{item.admissionType && ` · ${item.admissionType}`}
                  {/* F-16: 마이페이지에서는 추천 원서와 이유만 보여줘요. */}
                  {item.reasonText && <span className="mypage-detail-row__reason">{item.reasonText}</span>}
                </span>
                <CategoryBadge category={item.category} />
              </li>
            ))}
          </ol>

          <button type="button" className="mypage-primary-button mypage-detail-delete" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? '삭제 중…' : '이 리포트 삭제'}
          </button>
          {deleteError && <p className="mypage-logout-error" role="alert">{deleteError}</p>}
        </>
      )}

      <BottomNavigation />
    </div>
  );
}
