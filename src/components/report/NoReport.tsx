import BottomNavigation from '../common/BottomNavigation';
import noReport from '../../assets/images/no report.svg';
import './NoReport.css';

/**
 * 리포트 탭을 눌렀는데 아직 분석한 리포트가 없을 때 (Figma '마이페이지-리포트상세' 빈 화면).
 * 아이콘 + 제목 + 설명이 한 장으로 그려진 SVG(244 × 212)라서 문구는 화면 낭독기용으로 숨겨서 넣어요.
 */
export default function NoReport() {
  return (
    <section className="no-report" aria-labelledby="no-report-title">
      <div className="no-report__message">
        <img src={noReport} alt="" width="244" height="212" />
        <h1 id="no-report-title" className="no-report__sr-only">저장된 리포트가 없어요.</h1>
        <p className="no-report__sr-only">홈화면으로 이동해 생기부 분석을 진행해 주세요.</p>
      </div>
      <BottomNavigation />
    </section>
  );
}
