import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useGradeAnalysis } from '../../app/gradeAnalysisContext';
import arrowBack from '../../assets/icons/arrow-back.svg';
import analysisCharacter from '../../assets/images/analysis-character.svg';
import { SESSION_EXPIRED_PATH, isSessionExpiredError } from '../../services/authApi';
import type { ReturnToState } from '../../services/authApi';
import { clearAccessToken } from '../../services/authToken';
import { NoTokenError } from '../../services/reportApi';
import { runSimulation } from '../../services/simulationApi';
import { MOCK_ANALYSIS_STEPS, MOCK_ANALYSIS_STEP_DURATION_MS } from './analysisLoading.mock';
import './AnalysisLoadingPage.css';

/** 단계 애니메이션 최소 시간. 응답이 더 늦으면 마지막 단계에서 기다려요. */
const duration = MOCK_ANALYSIS_STEPS.length * MOCK_ANALYSIS_STEP_DURATION_MS;
/** 응답 전에는 마지막 단계를 끝까지 채우지 않아요. */
const WAITING_PROGRESS = 95;

export default function AnalysisLoadingPage() {
  const navigate = useNavigate();
  const { snapshot, setResult } = useGradeAnalysis();
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  // POST /api/simulations. 같은 snapshot 이면 같은 Idempotency-Key 라서 다시 보내도 한 번만 저장돼요.
  useEffect(() => {
    if (!snapshot) return;
    const controller = new AbortController();
    runSimulation(snapshot, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setResult(result);
        setDone(true);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // 401 UNAUTHORIZED·토큰 없음: 서버는 분석·저장을 시작하지 않았어요. 재로그인 후 성적 확인 화면으로 돌아가요(입력값 유지).
        if (error instanceof NoTokenError || isSessionExpiredError(error)) {
          clearAccessToken();
          const state: ReturnToState = { from: '/grade/confirm' };
          navigate(SESSION_EXPIRED_PATH, { replace: true, state });
          return;
        }
        // 400·5xx·네트워크 오류: 오류 화면의 '다시 시도'가 이 화면으로 돌아와 같은 키로 다시 요청해요.
        navigate('/error/analysis', { replace: true });
      });
    return () => controller.abort();
  }, [snapshot, setResult, navigate]);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.min(performance.now() - startedAt, duration);
      setElapsed(next);
      if (next === duration) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, [snapshot]);

  const finished = done && elapsed === duration;

  // 응답과 애니메이션이 모두 끝나면 리포트로. replace 라서 뒤로가기로 분석을 다시 보내지 않아요.
  useEffect(() => {
    if (finished) navigate('/report/summary', { replace: true });
  }, [finished, navigate]);

  // 분석할 성적이 없으면(새로고침 등) 성적 확인부터 다시 해요.
  if (!snapshot) return <Navigate to="/grade/confirm" replace />;

  return (
    <div className="analysis-loading-page">
      <header className="analysis-loading-header">
        <Link to="/grade/confirm" aria-label="성적 확인 화면으로 돌아가기">
          <img src={arrowBack} alt="" width="29" height="29" />
        </Link>
      </header>
      <section className="analysis-loading-content" aria-labelledby="analysis-loading-title">
        <h1 id="analysis-loading-title">{finished ? '분석이 완료됐어요.' : '성적을 환산하고 있어요...'}</h1>
        <ol className="analysis-loading-steps" aria-label="분석 진행 상태">
          {MOCK_ANALYSIS_STEPS.map((step, index) => {
            const isLast = index === MOCK_ANALYSIS_STEPS.length - 1;
            const stepElapsed = elapsed - index * MOCK_ANALYSIS_STEP_DURATION_MS;
            const rawProgress = Math.min(100, Math.max(0, Math.floor(stepElapsed / MOCK_ANALYSIS_STEP_DURATION_MS * 100)));
            const progress = isLast && !done ? Math.min(rawProgress, WAITING_PROGRESS) : rawProgress;
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
