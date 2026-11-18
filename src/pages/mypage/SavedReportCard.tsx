import { Link, useLocation } from 'react-router';
import type { SavedReportCardData } from './useSavedReports';
import './SavedReportCard.css';

type SavedReportCardProps = {
  report: SavedReportCardData;
  className?: string;
  /** 화면 제목 구조에 맞춘 카드 제목 수준 (마이페이지 h2, 메인 h3) */
  headingLevel?: 2 | 3;
};

/**
 * 저장된 리포트 카드: 날짜 + "학과 외 N개", 구간별 장수. 카드를 누르면 상세로 가요.
 * 삭제는 리포트 상세 화면에서만 할 수 있어요.
 */
export default function SavedReportCard({ report, className, headingLevel = 2 }: SavedReportCardProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const { pathname } = useLocation();
  return (
    <li className={`mypage-report-card${className ? ` ${className}` : ''}`}>
      <Heading className="mypage-report-card__title">
        {/* 상세 화면의 이전 버튼이 이 목록 화면(메인·마이페이지)으로 돌아오도록 지금 주소를 넘겨요. */}
        <Link to={`/mypage/reports/${report.id}`} state={{ from: pathname }}>
          <span className="mypage-report-card__date">{report.createdAt}</span>
          {report.title}
        </Link>
      </Heading>
      {report.summary && <p>{report.summary}</p>}
    </li>
  );
}
