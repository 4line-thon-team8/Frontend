import { NavLink } from 'react-router';

export default function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="주요 메뉴">
      <NavLink to="/grade/input">성적 입력</NavLink>
      <NavLink to="/mypage">마이페이지</NavLink>
    </nav>
  );
}
