import { Fragment } from 'react';
import BottomNavigation from '../../components/common/BottomNavigation';
import RecommendationEmpty from '../../components/report/RecommendationEmpty';
import ReportPagination from '../../components/report/ReportPagination';
import clipboard from '../../assets/icons/clipboard.svg';
import { useMockRecommendationResult } from './recommendation.mock';
import { MOCK_REPORT_SUMMARY, type RichTextPart } from './reportSummary.mock';
import './ReportPage.css';
import './ReportSummaryPage.css';

function RichLine({ parts }: { parts: RichTextPart[] }) {
  return parts.map((part, index) => (part.bold ? <strong key={index}>{part.text}</strong> : <Fragment key={index}>{part.text}</Fragment>));
}

export default function ReportSummaryPage() {
  // TODO: reportApi 구현 후 실제 리포트 데이터로 교체합니다.
  const { profileLines, overallLines } = MOCK_REPORT_SUMMARY;
  const { recommendations } = useMockRecommendationResult();

  // 공통 주의사항: FE 고정 문구. TODO: 추정 대상 학년도 문구는 확정되면 추가합니다.
  const header = (
    <header className="report-header">
      <h1>
        <img src={clipboard} alt="" width="15" height="17" />
        리포트 요약
      </h1>
      <p>*본 결과는 추정이며 합격을 보장하지 않아요.<br />실제 모집요강을 꼭 확인해 주세요.</p>
    </header>
  );

  // 추천 0장: 리포트 대신 조건 수정 안내
  if (recommendations.length === 0) {
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
        {profileLines.map(line => <p key={line}>{line}</p>)}
      </section>

      <hr className="report-divider" />

      <section className="report-summary-overall" aria-labelledby="report-overall-title">
        <h2 id="report-overall-title" className="report-section-label">총평</h2>
        <div className="report-fold-card report-fold-card--primary">
          {overallLines.map((parts, index) => <p key={index}><RichLine parts={parts} /></p>)}
        </div>
      </section>

      <div className="report-pagination-slot">
        <ReportPagination current={1} />
      </div>

      <BottomNavigation />
    </div>
  );
}
