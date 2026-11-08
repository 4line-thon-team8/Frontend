import { Link } from 'react-router';
import step1 from '../../assets/icons/step1.svg';
import step2 from '../../assets/icons/step2.svg';
import step3 from '../../assets/icons/step3.svg';
import './ReportPagination.css';

/*
 * 리포트 3단계 화면(요약 → 활동 지원 전략 → 추천 원서) 사이를 오가는 페이지 번호.
 * Figma 에서 내보낸 단계별 SVG(171 × 37)를 보여주고, 번호·화살표 위에 투명한 링크를 겹칩니다.
 * hit: SVG 위 클릭 영역 (x 시작, 폭) — 번호는 37px 원(중심 39.25 · 85.25 · 131.25)
 */
export const REPORT_PAGES = [
  { path: '/report/summary', label: '리포트 요약', image: step1, hit: { left: 20.75, width: 37 } },
  { path: '/report/strategy', label: '활동 지원 전략', image: step2, hit: { left: 66.75, width: 37 } },
  { path: '/report/recommendations', label: '추천 원서', image: step3, hit: { left: 112.75, width: 37 } },
] as const;

type HitArea = { left: number; width: number };
// 화살표 그림: x 0.75–7.75 / 162.75–169.75
const PREV_HIT: HitArea = { left: 0, width: 18 };
const NEXT_HIT: HitArea = { left: 153, width: 18 };

const area = (hit: HitArea) => ({ left: `${hit.left}px`, width: `${hit.width}px` });

/** @param current 현재 화면 번호 (1부터) */
export default function ReportPagination({ current }: { current: number }) {
  const page = REPORT_PAGES[current - 1];
  const prev = REPORT_PAGES[current - 2];
  const next = REPORT_PAGES[current];
  if (!page) return null;

  return (
    <nav className="report-pagination" aria-label="리포트 페이지">
      <img src={page.image} alt="" width="171" height="37" />
      {prev && <Link className="report-pagination__hit" style={area(PREV_HIT)} to={prev.path} aria-label={`이전: ${prev.label}`} />}
      {REPORT_PAGES.map((item, index) => (
        <Link
          key={item.path}
          className="report-pagination__hit"
          style={area(item.hit)}
          to={item.path}
          aria-label={`${index + 1}. ${item.label}`}
          aria-current={index + 1 === current ? 'page' : undefined}
        />
      ))}
      {next && <Link className="report-pagination__hit" style={area(NEXT_HIT)} to={next.path} aria-label={`다음: ${next.label}`} />}
    </nav>
  );
}
