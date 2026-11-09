import BottomNavigation from '../../components/common/BottomNavigation';
import ReportPagination from '../../components/report/ReportPagination';
import clipboard from '../../assets/icons/clipboard.svg';
import { MOCK_RECOMMENDATIONS, TIER_LABELS } from './recommendation.mock';
import './ReportPage.css';
import './RecommendationPage.css';

export default function RecommendationPage() {
  // TODO: reportApi 구현 후 실제 추천 원서 데이터로 교체합니다.
  const recommendations = MOCK_RECOMMENDATIONS;

  return (
    <div className="report-page">
      <header className="report-header">
        <h1>
          <img src={clipboard} alt="" width="15" height="17" />
          추천 원서 {recommendations.length}장
        </h1>
      </header>

      <ol className="recommendation-list">
        {recommendations.map(item => (
          <li key={item.rank} className={`report-fold-card recommendation-card is-${item.tier}`}>
            <h2>
              <span className="recommendation-card__rank">{item.rank}지망</span>
              {item.university} {item.major} · {item.admission}
            </h2>
            <span className="recommendation-card__tier">{TIER_LABELS[item.tier]}</span>
            <p className="recommendation-card__reason">{item.reason}</p>
            <p className="recommendation-card__evidence">근거 : {item.evidence}</p>
          </li>
        ))}
      </ol>

      <div className="report-pagination-slot">
        <ReportPagination current={3} />
      </div>

      <BottomNavigation />
    </div>
  );
}
