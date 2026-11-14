const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// BE 기준: 비밀번호 15~64자
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_PLACEHOLDER = `${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자로 작성해 주세요.`;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return '이메일을 입력해 주세요.';
  if (!EMAIL_PATTERN.test(email.trim())) return '올바른 이메일 형식이 아니에요.';
  return undefined;
}

/** 회원가입용: 길이까지 검사합니다. */
export function validatePassword(password: string): string | undefined {
  if (!password) return '비밀번호를 입력해 주세요.';
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자로 입력해 주세요.`;
  }
  return undefined;
}

/** 로그인용: 입력 여부만 확인하고, 맞는지는 서버(AUTHENTICATION_FAILED)가 판단해요. */
export function validateLoginPassword(password: string): string | undefined {
  return password ? undefined : '비밀번호를 입력해 주세요.';
}
