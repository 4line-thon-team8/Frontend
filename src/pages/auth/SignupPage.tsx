import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import Button from '../../components/common/Button';
import AuthField from '../../components/auth/AuthField';
import arrowBack from '../../assets/icons/arrow-back.svg';
import logo from '../../assets/images/logo.svg';
import { PASSWORD_MAX_LENGTH, validateEmail, validatePassword } from './authValidation';
import './AuthPage.css';

type SignupErrors = { email?: string; password?: string; passwordConfirm?: string };

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errors, setErrors] = useState<SignupErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: SignupErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
      passwordConfirm: !passwordConfirm
        ? '비밀번호를 다시 입력해 주세요.'
        : passwordConfirm !== password ? '비밀번호가 일치하지 않아요.' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password || nextErrors.passwordConfirm) return;

    // TODO: authApi 의 회원가입(POST /api/auth/signup) 구현 후 연동합니다.
    navigate('/login', { replace: true });
  };

  return (
    <section className="auth-page auth-page--signup" aria-labelledby="signup-title">
      <Link className="auth-back" to="/login" aria-label="로그인 화면으로 돌아가기">
        <img src={arrowBack} alt="" width="29" height="29" />
      </Link>

      <div className="auth-intro">
        <img className="auth-intro__logo" src={logo} alt="" width="57" height="60" />
        <h1 id="signup-title">안녕하세요.<br />오등급 입니다.</h1>
        <p>더 다양한 서비스를 위해 회원가입을 해주세요.</p>
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
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
            placeholder={`${PASSWORD_MAX_LENGTH}자 이내로 작성해 주세요.`}
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={errors.password}
          />
          <AuthField
            label="비밀번호 확인"
            type="password"
            name="passwordConfirm"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
            placeholder="비밀번호를 다시 입력해주세요."
            value={passwordConfirm}
            onChange={e => setPasswordConfirm(e.target.value)}
            error={errors.passwordConfirm}
          />
        </div>

        <div className="auth-actions">
          <Button type="submit" className="auth-submit">회원가입</Button>
        </div>
      </form>
    </section>
  );
}
