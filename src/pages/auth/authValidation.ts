const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MAX_LENGTH = 7;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return '이메일을 입력해 주세요.';
  if (!EMAIL_PATTERN.test(email.trim())) return '올바른 이메일 형식이 아니에요.';
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return '비밀번호를 입력해 주세요.';
  if (password.length > PASSWORD_MAX_LENGTH) return `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이내로 입력해 주세요.`;
  return undefined;
}
