import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import './BottomNavigation.css';

/*
 * 아이콘은 색을 CSS 로 바꾸기 위해 인라인 SVG 로 둡니다. (원본: clipboard.svg · nav-home.svg · nav-mypage.svg)
 * 활성 탭: 32px 초록 원 + 흰 아이콘 / 비활성 탭: 원 없이 회색 아이콘
 */
function ReportIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 36 40" fill="none" aria-hidden="true">
      <path d="M32 4H23.64C22.8 1.68 20.6 0 18 0C15.4 0 13.2 1.68 12.36 4H4C1.8 4 0 5.8 0 8V36C0 38.2 1.8 40 4 40H32C34.2 40 36 38.2 36 36V8C36 5.8 34.2 4 32 4ZM18 4C19.1 4 20 4.9 20 6C20 7.1 19.1 8 18 8C16.9 8 16 7.1 16 6C16 4.9 16.9 4 18 4ZM22 32H8V28H22V32ZM28 24H8V20H28V24ZM28 16H8V12H28V16Z" fill="currentColor" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="16 12 16 16" fill="none" aria-hidden="true">
      <path d="M17.7964 17.281L23.463 13.6749C23.7906 13.4664 24.2092 13.4664 24.5368 13.6749L30.2035 17.281C30.4919 17.4645 30.6666 17.7827 30.6666 18.1246V25.6666C30.6666 26.2189 30.2189 26.6666 29.6666 26.6666H18.3333C17.781 26.6666 17.3333 26.2189 17.3333 25.6666V18.1246C17.3333 17.7827 17.5079 17.4645 17.7964 17.281Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path className="bottom-navigation-home-line" d="M21.332 22.667H26.6654" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MypageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.51337 15.755C5.00904 13.7755 7.35831 12.5 10 12.5C12.6418 12.5 14.991 13.7755 16.4867 15.755C16.8086 16.181 16.9696 16.394 16.9643 16.6819C16.9602 16.9043 16.8206 17.1849 16.6456 17.3222C16.4191 17.5 16.1051 17.5 15.4773 17.5H4.52273C3.89493 17.5 3.58103 17.5 3.35451 17.3222C3.17951 17.1849 3.03984 16.9043 3.03577 16.6819C3.0305 16.394 3.19146 16.181 3.51337 15.755ZM13.75 6.25C13.75 8.32107 12.0711 10 10 10C7.92897 10 6.25004 8.32107 6.25004 6.25C6.25004 4.17893 7.92897 2.5 10 2.5C12.0711 2.5 13.75 4.17893 13.75 6.25Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavItem({ to, label, icon, active, end }: { to: string; label: string; icon: ReactNode; active?: boolean; end?: boolean }) {
  const content = (
    <>
      <span className="grade-bottom-navigation-icon">{icon}</span>
      <span className="grade-bottom-navigation-label">{label}</span>
    </>
  );
  // active 를 넘기면 그 값으로, 아니면 NavLink 가 주소 일치 여부로 활성(aria-current="page")을 표시합니다.
  if (active !== undefined) {
    return <Link className="grade-bottom-navigation-item" to={to} aria-current={active ? 'page' : undefined}>{content}</Link>;
  }
  return <NavLink className="grade-bottom-navigation-item" to={to} end={end}>{content}</NavLink>;
}

export default function BottomNavigation() {
  const { pathname } = useLocation();
  // 리포트 결과 화면(/report/*)에서 리포트 탭을 활성화합니다. 마이페이지 아래 화면(/mypage/*)은 마이페이지 탭이 활성화됩니다.
  const isReportActive = pathname.startsWith('/report/');

  return (
    <nav className="grade-bottom-navigation" aria-label="주요 메뉴">
      <NavItem to="/report/summary" label="리포트" icon={<ReportIcon />} active={isReportActive} />
      <NavItem to="/grade/input" label="홈" icon={<HomeIcon />} end />
      <NavItem to="/mypage" label="마이페이지" icon={<MypageIcon />} />
    </nav>
  );
}
