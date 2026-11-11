import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import arrowBack from '../../assets/icons/arrow-back.svg';
import analysisCharacter from '../../assets/images/analysis-character.svg';
import { MOCK_ANALYSIS_STEPS, MOCK_ANALYSIS_STEP_DURATION_MS } from './analysisLoading.mock';
import './AnalysisLoadingPage.css';

const duration = MOCK_ANALYSIS_STEPS.length * MOCK_ANALYSIS_STEP_DURATION_MS;

export default function AnalysisLoadingPage() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.min(performance.now() - startedAt, duration);
      setElapsed(next);
      if (next === duration) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, []);

  const finished = elapsed === duration;
  return (
    <div className="analysis-loading-page">
      <header className="analysis-loading-header">
        <Link to="/grade/confirm" aria-label="성적 확인 화면으로 돌아가기">
          <img src={arrowBack} alt="" width="29" height="29" />
        </Link>
      </header>
      <section className="analysis-loading-content" aria-labelledby="analysis-loading-title">
        <h1 id="analysis-loading-title">{finished ? '분석 시연이 완료됐어요.' : '성적을 환산하고 있어요...'}</h1>
        <ol className="analysis-loading-steps" aria-label="분석 진행 상태">
          {MOCK_ANALYSIS_STEPS.map((step, index) => {
            const stepElapsed = elapsed - index * MOCK_ANALYSIS_STEP_DURATION_MS;
            const progress = Math.min(100, Math.max(0, Math.floor(stepElapsed / MOCK_ANALYSIS_STEP_DURATION_MS * 100)));
            const status = progress === 100 ? 'complete' : stepElapsed > 0 ? 'running' : 'waiting';
            const statusLabel = status === 'complete' ? '완료!' : status === 'running' ? '진행 중' : '대기';
            return (
              <li className={`analysis-loading-step is-${status}`} key={step.id}>
                <h2>{step.label}</h2>
                <div className="analysis-loading-track" role="progressbar" aria-label={step.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={statusLabel}>
                  <span className="analysis-loading-fill" style={{ width: `${progress}%` }} />
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
