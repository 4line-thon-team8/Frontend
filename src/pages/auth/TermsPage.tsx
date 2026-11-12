import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import AuthImageButton from '../../components/auth/AuthImageButton';
import arrowBack from '../../assets/icons/arrow-back.svg';
import checkCircle from '../../assets/icons/check-circle.svg';
import startButton from '../../assets/icons/start-button.svg';
import startButtonBefore from '../../assets/icons/start-button-before.svg';
import character from '../../assets/images/agree-images.svg';
import './AuthPage.css';
import './TermsPage.css';

const PROCESS_STEPS = ['① 성적 입력 (촬영 · PDF)', '② 확인 · 지원 방향', '③ 컨설팅 리포트'];

const PRIVACY_NOTICES = [
  '성적표 원본은 서버로 전송되지 않고, 처리 후 폐기돼요.',
  '추천 원서·추천 이유·생성 시각은 로그인 계정에 저장돼요.',
];

export default function TermsPage() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agreed) return;
    // TODO: 약관 동의 저장 API 가 정해지면 연동합니다.
    navigate('/grade/input', { replace: true });
  };

  return (
    <section className="auth-page terms-page" aria-labelledby="terms-title">
      <Link className="auth-back" to="/signup" aria-label="회원가입 화면으로 돌아가기">
        <img src={arrowBack} alt="" width="29" height="29" />
      </Link>

      <h1 id="terms-title" className="terms-title">5등급제 서비스 이용을 위해<br />약관에 동의해 주세요.</h1>

      <div className="terms-hero" aria-hidden="true">
        <img className="terms-hero__character" src={character} alt="" width="140" height="114" />
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <section className="terms-box terms-box--process" aria-labelledby="terms-process-title">
          <h2 id="terms-process-title">진행 안내</h2>
          <ul>
            {PROCESS_STEPS.map(step => <li key={step}>{step}</li>)}
          </ul>
        </section>

        <section id="privacy-notice" className="terms-box terms-box--privacy" aria-labelledby="terms-privacy-title" tabIndex={-1}>
          <h2 id="terms-privacy-title">개인정보 안내</h2>
          <ol>
            {PRIVACY_NOTICES.map(notice => <li key={notice}>{notice}</li>)}
          </ol>
        </section>

        <div className="terms-agree">
          <label className="terms-agree__label">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} required />
            <img src={checkCircle} alt="" width="24" height="24" />
            <span>개인정보 처리 안내에 동의해요 (필수)</span>
          </label>
          <a className="terms-agree__detail" href="#privacy-notice">개인정보 처리 안내 자세히 보기 &gt;</a>
        </div>

        <div className="auth-actions">
          {/* 필수 동의에 체크하기 전에는 회색(비활성) 버튼을 보여줍니다. */}
          <AuthImageButton label="시작하기" activeSrc={startButton} beforeSrc={startButtonBefore} enabled={agreed} />
        </div>
      </form>
    </section>
  );
}
