import { Navigate } from 'react-router';
import BottomNavigation from '../../components/common/BottomNavigation';
import RecommendationEmpty from '../../components/report/RecommendationEmpty';
import ReportPagination from '../../components/report/ReportPagination';
import clipboard from '../../assets/icons/clipboard.svg';
import { isNoCandidates } from '../../components/report/resultWarnings';
import type { SaveStatus } from '../../services/simulationApi';
import { sectionLines, useReportView } from './analysisResult';
import './ReportPage.css';
import './ReportSummaryPage.css';

/** 자동 저장 결과 안내. 응답에 저장 결과가 없으면 아무것도 단정하지 않아요. */
const SAVE_STATUS_MESSAGES: Partial<Record<SaveStatus, string>> = {
  SAVED: '입력하신 성적은 저장되지 않아요. 이 리포트는 내 계정에 자동 저장됐어요.',
  FAILED: '리포트를 저장하지 못했어요. 이 결과는 지금 화면에서만 볼 수 있어요.',
};

export default function ReportSummaryPage() {
  const view = useReportView();
  // 분석 결과 없이 들어오면(새로고침 등) 성적 입력부터 다시 시작해요.
  if (!view) return <Navigate to="/grade/input" replace />;

  const overallLines = sectionLines(view.report.overallAssessment);
  const saveMessage = view.saveStatus ? SAVE_STATUS_MESSAGES[view.saveStatus] : undefined;

  // 공통 주의사항: FE 고정 문구. TODO: 추정 대상 학년도 문구는 확정되면 추가합니다.
  const header = (
    <header className="report-header">
      <h1>
        <img src={clipboard} alt="" width="15" height="17" />
        리포트 요약
      </h1>
      <p>*본 결과는 추정이며 합격을 보장하지 않아요.<br />실제 모집요강을 꼭 확인해 주세요.</p>
      {saveMessage && <p className={`report-save-status${view.saveStatus === 'FAILED' ? ' report-save-status--failed' : ''}`} role="status">{saveMessage}</p>}
    </header>
  );

  // 추천 0장: 리포트 대신 조건 수정 안내
  if (isNoCandidates(view)) {
    return (
      <div className="report-page">
        {header}
        <RecommendationEmpty />
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="report-page report-page--fixed-pagination">
      {header}

      <section className="report-fold-card report-summary-profile" aria-label="희망 학과와 선호 전형">
        {view.profileLines.map(line => <p key={line}>{line}</p>)}
      </section>

      <hr className="report-divider" />

      {overallLines.length > 0 && (
        <section className="report-summary-overall" aria-labelledby="report-overall-title">
          <h2 id="report-overall-title" className="report-section-label">총평</h2>
          <div className="report-fold-card report-fold-card--primary">
            {overallLines.map((line, index) => <p key={index}>{line}</p>)}
          </div>
        </section>
      )}

      <div className="report-pagination-slot">
        <ReportPagination current={1} />
      </div>

      <BottomNavigation />
    </div>
  );
}
