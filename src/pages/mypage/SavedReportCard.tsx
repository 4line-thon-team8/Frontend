import { Link } from 'react-router';
import type { SavedReportCardData } from './useSavedReports';
import './SavedReportCard.css';

function TrashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type SavedReportCardProps = {
  report: SavedReportCardData;
  deleting: boolean;
  deleteDisabled: boolean;
  onDelete: () => void;
  className?: string;
  /** 화면 제목 구조에 맞춘 카드 제목 수준 (마이페이지 h2, 메인 h3) */
  headingLevel?: 2 | 3;
};

/** 저장된 리포트 카드: 날짜 + "학과 외 N개", 구간별 장수, 오른쪽 아래 삭제. 카드를 누르면 상세로 가요. */
export default function SavedReportCard({ report, deleting, deleteDisabled, onDelete, className, headingLevel = 2 }: SavedReportCardProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <li className={`mypage-report-card${className ? ` ${className}` : ''}`}>
      <Heading className="mypage-report-card__title">
        <Link to={`/mypage/reports/${report.id}`}>
          <span className="mypage-report-card__date">{report.createdAt}</span>
          {report.title}
        </Link>
      </Heading>
      {report.summary && <p>{report.summary}</p>}
      <button type="button" className="mypage-report-card__delete" onClick={onDelete} disabled={deleteDisabled} aria-label={`${report.createdAt} 리포트 삭제`}>
        <TrashIcon />
        {deleting ? '삭제 중…' : '삭제'}
      </button>
    </li>
  );
}
