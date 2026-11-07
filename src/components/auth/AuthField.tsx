import { useId, type InputHTMLAttributes } from 'react';

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  error?: string;
};

/** 로그인·회원가입 화면의 라벨 + 회색 입력창 + 오류 문구 묶음 */
export default function AuthField({ label, error, ...inputProps }: AuthFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && <p id={errorId} className="auth-field__error">{error}</p>}
    </div>
  );
}
