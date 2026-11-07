import { Link } from 'react-router';
import arrowBack from '../../assets/icons/arrow-back.svg';
import analysisCharacter from '../../assets/images/analysis-character.svg';
import { MOCK_ANALYSIS_STEPS } from './analysisLoading.mock';
import './AnalysisLoadingPage.css';

export default function AnalysisLoadingPage() {
  return (
    <div className="analysis-loading-page">
      <header className="analysis-loading-header">
        <Link to="/grade/confirm" aria-label="성적 확인 화면으로 돌아가기">
          <img src={arrowBack} alt="" width="29" height="29" />
        </Link>
      </header>
      <section className="analysis-loading-content" aria-labelledby="analysis-loading-title">
        <h1 id="analysis-loading-title">성적을 환산하고 있어요...</h1>
        <ol className="analysis-loading-steps" aria-label="분석 진행 상태">
          {MOCK_ANALYSIS_STEPS.map(step => {
            const complete = step.status === 'complete';
            const statusLabel = complete ? '완료!' : '대기';
            return (
              <li className={`analysis-loading-step is-${step.status}`} key={step.id}>
                <h2>{step.label}</h2>
                <div className="analysis-loading-track" role="progressbar" aria-label={step.label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={complete ? 1 : 0} aria-valuetext={statusLabel}>
                  <span className="analysis-loading-fill" />
                </div>
                <p>{statusLabel}</p>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="analysis-loading-footer" aria-hidden="true">
        <img className="analysis-loading-character" src={analysisCharacter} alt="" width="204" height="170" />
      </div>
    </div>
  );
}
