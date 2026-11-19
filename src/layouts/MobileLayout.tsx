import { Suspense } from 'react';
import { Outlet } from 'react-router';

export default function MobileLayout() {
  return <div className="mobile-layout"><main id="main-content"><Suspense fallback={null}><Outlet /></Suspense></main></div>;
}
