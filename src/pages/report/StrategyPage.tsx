import BottomNavigation from '../../components/common/BottomNavigation';
import ReportPagination from '../../components/report/ReportPagination';
import clipboard from '../../assets/icons/clipboard.svg';
import RecommendationEmpty from '../../components/report/RecommendationEmpty';
import { isNoCandidates } from '../../components/report/resultWarnings';
import { useMockRecommendationResult } from './recommendation.mock';
import { countByTier, tierClassName } from './reportTier';
import { MOCK_STRATEGY_REPORT, SCORE_MAX } from './strategy.mock';
import './ReportPage.css';
import './StrategyPage.css';

export default function StrategyPage() {
  // TODO: reportApi 구현 후 실제 리포트 데이터로 교체합니다.
  const { activitySummaryLines, scores, advices } = MOCK_STRATEGY_REPORT;
  const result = useMockRecommendationResult();
  const { recommendations } = result;
  // 추천 카드의 구간(BE 값)별 장수. 0장인 구간은 표시하지 않아요.
  const applications = countByTier(recommendations);

  if (isNoCandidates(result)) {
    return (
      <div className="report-page">
        <header className="report-header">
          <h1>
            <img src={clipboard} alt="" width="15" height="17" />
            활동·지원 전략
          </h1>
        </header>
        <RecommendationEmpty />
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="report-page report-page--fixed-pagination">
      <header className="report-header">
        <h1>
          <img src={clipboard} alt="" width="15" height="17" />
          활동·지원 전략
        </h1>
        <p>*활동 입력 내용은 저장되지 않아요.</p>
      </header>

      <section className="report-fold-card strategy-activity" aria-label="입력한 활동 요약">
        {activitySummaryLines.map(line => <p key={line}>{line}</p>)}
      </section>

      <hr className="report-divider" />

      <section className="strategy-strengths" aria-labelledby="strategy-strengths-title">
        <h2 id="strategy-strengths-title" className="report-section-label">활동에서의 강점</h2>
        <div className="report-fold-card report-fold-card--primary strategy-scores">
          <ul>
            {scores.map(item => (
              <li key={item.id} className="strategy-score">
                <h3>{item.name}</h3>
                <div className="strategy-score__detail">
                  <div className="strategy-score__bar" role="img" aria-label={`${SCORE_MAX}점 중 ${item.score}점`}>
                    {Array.from({ length: SCORE_MAX }, (_, index) => (
                      <span key={index} className={index < item.score ? 'is-filled' : undefined} />
                    ))}
                  </div>
                  <p>{item.description}</p>
                </div>
                <span className="strategy-score__value" aria-hidden="true"><strong>{item.score}</strong> / {SCORE_MAX}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="report-fold-card strategy-advice" aria-label="학과별 활동 조언">
        {advices.map(item => (
          <div key={item.major} className="strategy-advice__item">
            <h2>{item.major}</h2>
            <p>{item.advice}</p>
          </div>
        ))}
      </section>

      <hr className="report-divider" />

      <section className="strategy-applications" aria-labelledby="strategy-applications-title">
        <h2 id="strategy-applications-title" className="report-section-label">나의 지원 전략</h2>
        <ul>
          {applications.map(item => (
            <li key={item.tier} className={`strategy-application ${tierClassName(item.tier)}`}>
              <span className="strategy-application__count"><strong>{item.count}</strong> 장</span>
              <span className="strategy-application__label">{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="report-pagination-slot">
        <ReportPagination current={2} />
      </div>

      <BottomNavigation />
    </div>
  );
}
