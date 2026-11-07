import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import Button from '../../components/common/Button';
import AuthField from '../../components/auth/AuthField';
import logo from '../../assets/images/logo.svg';
import { PASSWORD_MAX_LENGTH, validateEmail, validatePassword } from './authValidation';
import './AuthPage.css';

type LoginErrors = { email?: string; password?: string };

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: LoginErrors = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    // TODO: authApi 의 로그인(POST /api/auth/login) 구현 후 연동합니다.
    navigate('/grade/input', { replace: true });
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
            placeholder={`${PASSWORD_MAX_LENGTH}자 이내로 작성해 주세요.`}
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={errors.password}
          />
        </div>

        <div className="auth-actions">
          <Button type="submit" className="auth-submit">로그인</Button>
          <Link className="auth-link" to="/signup">회원가입</Link>
        </div>
      </form>
    </section>
  );
}
