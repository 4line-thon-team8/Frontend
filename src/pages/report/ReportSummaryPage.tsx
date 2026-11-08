import { Fragment } from 'react';
import BottomNavigation from '../../components/common/BottomNavigation';
import ReportPagination from '../../components/report/ReportPagination';
import clipboard from '../../assets/icons/clipboard.svg';
import { MOCK_REPORT_SUMMARY, type RichTextPart } from './reportSummary.mock';
import './ReportPage.css';
import './ReportSummaryPage.css';

function RichLine({ parts }: { parts: RichTextPart[] }) {
  return parts.map((part, index) => (part.bold ? <strong key={index}>{part.text}</strong> : <Fragment key={index}>{part.text}</Fragment>));
}

export default function ReportSummaryPage() {
  // TODO: reportApi 구현 후 실제 리포트 데이터로 교체합니다.
  const { profileLines, overallLines } = MOCK_REPORT_SUMMARY;

  return (
    <div className="report-page">
      <header className="report-header">
        <h1>
          <img src={clipboard} alt="" width="15" height="17" />
          리포트 요약
        </h1>
        <p>*본 결과는 추정이며 합격을 보장하지 않습니다.<br />실제 모집요강을 꼭 확인하세요.</p>
      </header>

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
