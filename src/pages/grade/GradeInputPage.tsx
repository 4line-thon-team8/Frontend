import { Link } from 'react-router';
import BottomNavigation from '../../components/common/BottomNavigation';
import camera from '../../assets/icons/camera.svg';
import chevron from '../../assets/icons/chevron-right.svg';
import clipboard from '../../assets/icons/clipboard.svg';
import logo from '../../assets/icons/logo.svg';
import brandLogo from '../../assets/icons/brand-logo.svg';
import report from '../../assets/icons/report.svg';
import character from '../../assets/images/grade-character.svg';
import './GradeInputPage.css';

export default function GradeInputPage() {
  return (
    <div className="grade-input-page">
      <div className="grade-input-content">
        <header className="grade-input-brand" aria-label="오등급">
          <img src={logo} alt="" width="29" height="31" />
          <img className="grade-input-brand-wordmark" src={brandLogo} alt="오등급" width="51" height="22" />
        </header>
        <section className="grade-input-intro" aria-labelledby="grade-input-title">
          <h1 id="grade-input-title">내 성적으로 찾는<br />나에게 맞는 원서 6장</h1>
          <p>성적표를 촬영하거나,<br />정부24 PDF를 올려주세요.</p>
          <img className="grade-input-character" src={character} alt="" width="168" height="131" />
        </section>

        <div className="grade-input-options">
          <Link className="grade-input-card grade-input-card-camera" to="/grade/camera">
            <img className="grade-input-card-icon" src={camera} alt="" width="46" height="46" />
            <div className="grade-input-card-copy">
              <h2>성적표 촬영</h2>
              <p>성적표가 잘 인식되도록 밝은 곳에서 촬영해 주세요.</p>
            </div>
            <img className="grade-input-chevron" src={chevron} alt="" width="10" height="18" />
          </Link>
          <Link className="grade-input-card grade-input-card-pdf" to="/grade/upload">
            <img className="grade-input-card-icon" src={clipboard} alt="" width="36" height="40" />
            <div className="grade-input-card-copy">
              <h2>정부 24 PDF 올리기</h2>
              <p><span className="grade-input-pdf-step">정부24 접속 → [중등학교 성적증명] 검색 →</span><br />발급 신청 → PDF 저장</p>
            </div>
            <img className="grade-input-chevron" src={chevron} alt="" width="10" height="18" />
          </Link>
        </div>

        <section className="grade-input-reports" aria-labelledby="grade-input-reports-title">
          <div className="grade-input-reports-heading">
            <h2 id="grade-input-reports-title">나의 리포트</h2>
            <Link to="/mypage/reports">전체 보기<img src={chevron} alt="" width="6" height="10" /></Link>
          </div>
          <div className="grade-input-empty">
            <img src={report} alt="" width="36" height="36" />
            <p>첫 번째 리포트를 만들어보세요.</p>
          </div>
        </section>
      </div>
      <BottomNavigation />
    </div>
  );
}
