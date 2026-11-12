import { Link, useNavigate, useParams } from 'react-router';
import BottomNavigation from '../../components/common/BottomNavigation';
import arrowBack from '../../assets/icons/arrow-back.svg';
import { MOCK_RECOMMENDATIONS } from '../report/recommendation.mock';
import { TIER_LABELS, tierClassName } from '../report/reportTier';
import { MOCK_SAVED_REPORTS } from './mypage.mock';
import './MyPage.css';

export default function ReportDetailPage() {
  const navigate = useNavigate();
  const { reportId } = useParams();
  // TODO: GET /api/reports/{report_id} 구현 후 실제 리포트로 교체합니다.
  const report = MOCK_SAVED_REPORTS.find(item => item.id === reportId);
  const recommendations = MOCK_RECOMMENDATIONS;

  const handleDelete = () => {
    // TODO: DELETE /api/reports/{report_id} 연동 후 성공했을 때만 이동합니다.
    navigate('/mypage', { replace: true });
  };

  return (
    <div className="mypage-page mypage-page--detail">
      <Link className="mypage-back" to="/mypage" aria-label="마이페이지로 돌아가기">
        <img src={arrowBack} alt="" width="29" height="29" />
      </Link>

      <h1 className="mypage-detail-title">리포트 상세</h1>

      {report ? (
        <>
          <p className="mypage-detail-created">{report.createdAt} 생성</p>

          <ol className="mypage-detail-list">
            {recommendations.map(item => (
              <li key={item.rank} className="mypage-detail-row">
                <span className="mypage-detail-row__rank">{item.rank}지망</span>
                <span className="mypage-detail-row__name">{item.university} {item.major} · {item.admission}</span>
                <span className={`mypage-detail-row__tier ${tierClassName(item.tier)}`}>{TIER_LABELS[item.tier]}</span>
              </li>
            ))}
          </ol>

          <button type="button" className="mypage-primary-button mypage-detail-delete" onClick={handleDelete}>이 리포트 삭제</button>
        </>
      ) : (
        <p className="mypage-detail-created">리포트를 찾을 수 없어요.</p>
      )}

      <BottomNavigation />
    </div>
  );
}
