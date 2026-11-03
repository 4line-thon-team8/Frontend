import { Outlet } from 'react-router';

export default function MobileLayout() {
  return <div className="mobile-layout"><main id="main-content"><Outlet /></main></div>;
}
