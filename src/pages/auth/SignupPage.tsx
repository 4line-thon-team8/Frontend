import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import AuthField from '../../components/auth/AuthField';
import AuthImageButton from '../../components/auth/AuthImageButton';
import arrowBack from '../../assets/icons/arrow-back.svg';
import logo from '../../assets/images/logo.svg';
import signupButton from '../../assets/icons/signup-button.svg';
import signupButtonBefore from '../../assets/icons/signup-button-before.svg';
import { getErrorCode, login, signup } from '../../services/authApi';
import { PASSWORD_MAX_LENGTH, PASSWORD_PLACEHOLDER, validateEmail, validatePassword } from './authValidation';
import './AuthPage.css';

type SignupErrors = { email?: string; password?: string; passwordConfirm?: string; form?: string };

export default function SignupPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errors, setErrors] = useState<SignupErrors>({});
  // 세 칸을 모두 입력하기 전에는 회색(비활성) 버튼을 보여줍니다.
  const canSubmit = email.trim() !== '' && password !== '' && passwordConfirm !== '' && !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors: SignupErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
      passwordConfirm: !passwordConfirm
        ? '비밀번호를 다시 입력해 주세요.'
        : passwordConfirm !== password ? '비밀번호가 일치하지 않아요.' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password || nextErrors.passwordConfirm) return;

    setSubmitting(true);
    const credentials = { email: email.trim(), password };
    try {
      await signup(credentials);
    } catch (error) {
      setSubmitting(false);
      if (getErrorCode(error) === 'EMAIL_ALREADY_EXISTS') setErrors({ email: '이미 가입된 이메일이에요.' });
      else setErrors({ form: '회원가입하지 못했어요. 잠시 후 다시 시도해 주세요.' });
      return;
    }

    // 가입 후 자동 로그인이 없어서 이어서 로그인합니다.
    try {
      await login(credentials);
    } catch {
      // 가입은 됐으니 로그인 화면에서 다시 로그인하면 돼요.
      navigate('/login', { replace: true });
      return;
    }
    // 회원가입 후 약관 동의 화면으로 이어집니다.
    navigate('/terms');
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
            placeholder={PASSWORD_PLACEHOLDER}
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
          {errors.form && <p className="auth-field__error" role="alert">{errors.form}</p>}
        </div>

        <div className="auth-actions">
          <AuthImageButton label="회원가입" activeSrc={signupButton} beforeSrc={signupButtonBefore} enabled={canSubmit} />
        </div>
      </form>
    </section>
  );
}
