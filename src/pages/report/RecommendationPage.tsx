import BottomNavigation from '../../components/common/BottomNavigation';
import RecommendationEmpty from '../../components/report/RecommendationEmpty';
import ReportPagination from '../../components/report/ReportPagination';
import ResultNotices from '../../components/report/ResultNotices';
import { getCardWarnings, isNoCandidates } from '../../components/report/resultWarnings';
import clipboard from '../../assets/icons/clipboard.svg';
import { useMockRecommendationResult } from './recommendation.mock';
import { TIER_LABELS, tierClassName } from './reportTier';
import './ReportPage.css';
import './RecommendationPage.css';

export default function RecommendationPage() {
  // TODO: reportApi 구현 후 실제 추천 원서 데이터로 교체합니다.
  const result = useMockRecommendationResult();
  const { recommendations, warnings } = result;

  return (
    <div className="report-page">
      <header className="report-header">
        <h1>
          <img src={clipboard} alt="" width="15" height="17" />
          추천 원서 {recommendations.length}장
        </h1>
      </header>

      {isNoCandidates(result) ? <RecommendationEmpty /> : (
        <>
          <ResultNotices count={recommendations.length} warnings={warnings} />

          {/* 카드 순서·rank·구간은 BE 응답 그대로 */}
          <ol className="recommendation-list">
            {recommendations.map(item => {
              const cardWarnings = getCardWarnings(warnings, item);
              return (
                <li key={item.rank} className={`report-fold-card recommendation-card ${tierClassName(item.tier)}`}>
                  <h2>
                    <span className="recommendation-card__rank">{item.rank}지망</span>
                    {item.university} {item.major} · {item.admission}
                  </h2>
                  <span className="recommendation-card__tier">{TIER_LABELS[item.tier]}</span>
                  <p className="recommendation-card__reason">{item.reason.text}</p>
                  {cardWarnings.map(warning => (
                    <p key={`${warning.code}-${warning.message}`} className="recommendation-card__warning">{warning.message}</p>
                  ))}
                  <p className="recommendation-card__evidence">근거 : {item.evidence}</p>
                </li>
              );
            })}
          </ol>

          <div className="report-pagination-slot">
            <ReportPagination current={3} />
          </div>
        </>
      )}

      <BottomNavigation />
    </div>
  );
}
