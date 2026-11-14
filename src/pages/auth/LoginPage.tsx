import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import AuthField from '../../components/auth/AuthField';
import AuthImageButton from '../../components/auth/AuthImageButton';
import logo from '../../assets/images/logo.svg';
import loginButton from '../../assets/icons/login-button.svg';
import loginButtonBefore from '../../assets/icons/login-button-before.svg';
import { getErrorCode, getReturnTo, login } from '../../services/authApi';
import { PASSWORD_MAX_LENGTH, validateEmail, validateLoginPassword } from './authValidation';
import './AuthPage.css';

type LoginErrors = { email?: string; password?: string; form?: string };

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  // 이메일·비밀번호를 모두 입력하기 전에는 회색(비활성) 버튼을 보여줍니다.
  const canSubmit = email.trim() !== '' && password !== '' && !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors: LoginErrors = { email: validateEmail(email), password: validateLoginPassword(password) };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      // 세션 만료로 왔다면 원래 화면(예: S-03)으로, 아니면 성적 입력으로 이동해요.
      navigate(getReturnTo(location.state) ?? '/grade/input', { replace: true });
    } catch (error) {
      setErrors({
        form: getErrorCode(error) === 'AUTHENTICATION_FAILED'
          ? '이메일 또는 비밀번호를 확인해 주세요.'
          : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page auth-page--login" aria-labelledby="login-title">
      <h1 id="login-title" className="auth-sr-only">로그인</h1>
      <div className="auth-hero" aria-hidden="true">
        <img className="auth-hero__logo" src={logo} alt="" width="422" height="438" />
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-fields">
          <AuthField
            label="이메일"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="example@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={errors.email}
          />
          <AuthField
            label="비밀번호"
            type="password"
            name="password"
            autoComplete="current-password"
            maxLength={PASSWORD_MAX_LENGTH}
            placeholder="비밀번호를 입력해 주세요."
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={errors.password}
          />
          {errors.form && <p className="auth-field__error" role="alert">{errors.form}</p>}
        </div>

        <div className="auth-actions">
          <AuthImageButton label="로그인" activeSrc={loginButton} beforeSrc={loginButtonBefore} enabled={canSubmit} />
          <Link className="auth-link" to="/signup">회원가입</Link>
        </div>
      </form>
    </section>
  );
}
