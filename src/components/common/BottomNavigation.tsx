import { NavLink } from 'react-router';
import report from '../../assets/icons/report.svg';
import home from '../../assets/icons/nav-home.svg';
import mypage from '../../assets/icons/nav-mypage.svg';
import './BottomNavigation.css';

export default function BottomNavigation() {
  return (
    <nav className="grade-bottom-navigation" aria-label="주요 메뉴">
      <NavLink className="grade-bottom-navigation-item" to="/mypage/reports">
        <img src={report} alt="" width="24" height="24" />
        <span>리포트</span>
      </NavLink>
      <NavLink className="grade-bottom-navigation-item grade-bottom-navigation-home" to="/grade/input" end>
        <img src={home} alt="" width="60" height="60" />
        <span>홈</span>
      </NavLink>
      <NavLink className="grade-bottom-navigation-item" to="/mypage" end>
        <img src={mypage} alt="" width="24" height="24" />
        <span>마이페이지</span>
      </NavLink>
    </nav>
  );
}
