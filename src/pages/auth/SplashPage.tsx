import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import logo from '../../assets/images/logo.svg';
import brandLogo from '../../assets/icons/brand-logo.svg';
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
        <img className="splash__logo" src={logo} alt="" width="106" height="109" />
        <h1 className="splash__title">
          <img src={brandLogo} alt="오등급" width="83" height="36" />
        </h1>
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
