import { useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import logo from '../../assets/images/logo.svg';
import './SplashPage.css';

const SPLASH_DURATION_MS = 2000;

export default function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/login', { replace: true }), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <section className="splash">
      <div className="splash__brand">
        <span className="splash__logo" style={{ '--logo-url': `url(${logo})` } as CSSProperties} aria-hidden="true" />
        <h1 className="splash__title">오 등급</h1>
        <p className="splash__subtitle">내 생기부로 찾는 나만의 진학 방향</p>
      </div>

      <div className="splash__loading" role="status" aria-label="불러오는 중">
        <span className="splash__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="splash__loading-text" aria-hidden="true">LOADING</span>
      </div>
    </section>
  );
}
