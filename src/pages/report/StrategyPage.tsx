import BottomNavigation from '../../components/common/BottomNavigation';
import ReportPagination from '../../components/report/ReportPagination';
import clipboard from '../../assets/icons/clipboard.svg';
import { MOCK_STRATEGY_REPORT, SCORE_MAX } from './strategy.mock';
import './ReportPage.css';
import './StrategyPage.css';

export default function StrategyPage() {
  // TODO: reportApi 구현 후 실제 리포트 데이터로 교체합니다.
  const { activitySummaryLines, scores, advices, applications } = MOCK_STRATEGY_REPORT;

  return (
    <div className="report-page">
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

      <section className="report-fold-card report-fold-card--primary strategy-scores" aria-label="활동 역량 평가">
        <ul>
          {scores.map(item => (
            <li key={item.id} className="strategy-score">
              <h2>{item.name}</h2>
              <div className="strategy-score__detail">
                <div className="strategy-score__bar" role="img" aria-label={`${SCORE_MAX}점 중 ${item.score}점`}>
                  {Array.from({ length: SCORE_MAX }, (_, index) => (
                    <span key={index} className={index < item.score ? 'is-filled' : undefined} />
                  ))}
                </div>
                <p>{item.description}</p>
              </div>
              <span className="strategy-score__value" aria-hidden="true">{item.score} / {SCORE_MAX}</span>
            </li>
          ))}
        </ul>
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
            <li key={item.tier} className={`strategy-application is-${item.tier}`}>
              <span className="strategy-application__count"><strong>{item.count}</strong> 장</span>
              <span className="strategy-application__label">{item.label}</span>
            </li>
          ))}
        </ul>
        <p className="strategy-applications__note">*상향 카드 포함 설정이 반영됐어요.</p>
      </section>

      <div className="report-pagination-slot strategy-pagination">
        <ReportPagination current={2} />
      </div>

      <BottomNavigation />
    </div>
  );
}
