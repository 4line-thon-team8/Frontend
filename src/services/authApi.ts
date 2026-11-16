// FE2: POST /api/auth/signup, /api/auth/login, /api/auth/logout
// DELETE /api/users/me (회원 탈퇴)
import { ApiError, apiClient } from './apiClient';
import { clearAccessToken, getAccessToken, setAccessToken } from './authToken';

/** BE 주소(VITE_API_BASE_URL)가 없으면 시연용 목 로그인으로 동작합니다. */
export const USE_MOCK_AUTH = !import.meta.env.VITE_API_BASE_URL;

const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;

export type Credentials = { email: string; password: string };
/** 200 응답. expiresAt 필수 여부는 명세상 아직 미정이라 없을 수도 있어요. */
type LoginResponse = { accessToken: string; expiresAt?: string };

function postJson(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  };
}

function isLoginResponse(body: unknown): body is LoginResponse {
  if (typeof body !== 'object' || body === null) return false;
  const { accessToken, expiresAt } = body as Record<string, unknown>;
  return typeof accessToken === 'string' && accessToken !== '' && (expiresAt === undefined || typeof expiresAt === 'string');
}

/** 201, 본문 없음. 가입 후 자동 로그인은 없어서 이어서 login() 을 호출해야 해요. */
export async function signup(credentials: Credentials): Promise<void> {
  if (USE_MOCK_AUTH) return;
  await apiClient('/api/auth/signup', postJson(credentials));
}

export async function login(credentials: Credentials): Promise<void> {
  if (USE_MOCK_AUTH) {
    setAccessToken('mock-access-token', new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString());
    return;
  }
  const body = await apiClient('/api/auth/login', postJson(credentials));
  if (!isLoginResponse(body)) throw new Error('로그인 응답 형식이 올바르지 않아요.');
  // expiresAt 이 없거나 읽을 수 없으면 합의된 2시간 만료로 계산해요. (서버도 만료를 따로 검사해요)
  const expiresAt = body.expiresAt && !Number.isNaN(Date.parse(body.expiresAt))
    ? body.expiresAt
    : new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString();
  setAccessToken(body.accessToken, expiresAt);
}

/**
 * 로그인 실패 문구. 로그인 요청 자체의 401 은 code 와 관계없이 로그인 실패로 안내해요
 * (보호 API 의 401 = 세션 만료와 구분). 계정 존재 여부가 드러나지 않게 같은 문구를 써요.
 */
export function getLoginErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE;
  if (error instanceof ApiError && error.status === 401) return '이메일 또는 비밀번호를 확인해 주세요.';
  if (error instanceof ApiError && error.status === 400) return '이메일 형식을 확인해 주세요.';
  return '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

/**
 * POST /api/auth/logout → 204, 본문 없음. 서버가 현재 토큰만 폐기해요.
 * 명세: FE 메모리에서 지우는 것만으로 폐기 성공으로 보지 않아요. 그래서 서버 응답을 보고 나서 지웁니다.
 * - 204: 폐기 완료 → 메모리 토큰 삭제
 * - 401: 이미 만료·폐기된 토큰 → 서버에서도 쓸 수 없으니 로그아웃된 것으로 처리
 * - 그 외(네트워크·5xx): 토큰을 남겨두고 에러를 던져요. 화면에서 다시 시도하게 안내합니다.
 */
export async function logout(): Promise<void> {
  const token = getAccessToken();
  // 토큰이 없거나 이미 만료됐으면 서버에서도 쓸 수 없는 토큰이라 요청할 필요가 없어요.
  if (USE_MOCK_AUTH || !token) {
    clearAccessToken();
    return;
  }
  try {
    await apiClient('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
  }
  clearAccessToken();
}

/**
 * DELETE /api/users/me → 204, 본문 없음. 계정·저장 리포트를 모두 지우고 모든 토큰을 폐기해요. 복구할 수 없어요.
 * 성공했을 때만 메모리 토큰을 지워요. 401 은 화면에서 세션 만료로 보내고, 그 외 실패는 그대로 던집니다.
 */
export async function withdraw(): Promise<void> {
  if (USE_MOCK_AUTH) {
    clearAccessToken();
    return;
  }
  const token = getAccessToken();
  // 토큰이 없으면 서버가 401 을 주는 것과 같아요. 세션 만료 흐름으로 보내도록 401 로 맞춰 던집니다.
  if (!token) throw new ApiError(401, { code: 'UNAUTHORIZED' });
  await apiClient('/api/users/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  clearAccessToken();
}

/** S-06 #13: 탈퇴 전 복구 불가 안내와 최종 확인 */
export const WITHDRAW_CONFIRM = '정말 탈퇴할까요?\n계정과 저장된 리포트가 모두 삭제되고, 복구할 수 없어요.';

/** S-06 #13 고정 문구 */
export const WITHDRAW_ERROR_MESSAGE = '탈퇴를 완료하지 못했어요. 다시 시도해 주세요.';

/** BE 에러 본문 { code, message } 의 code */
export function getErrorCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || typeof error.body !== 'object' || error.body === null) return undefined;
  const { code } = error.body as Record<string, unknown>;
  return typeof code === 'string' ? code : undefined;
}

/**
 * 분석·리포트 요청의 401(UNAUTHORIZED: 토큰 없음·만료·폐기) → 세션 만료 화면으로 보냅니다.
 * 로그인 실패(AUTHENTICATION_FAILED)도 401 이라 code 로 구분해요.
 */
export function isSessionExpiredError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && getErrorCode(error) !== 'AUTHENTICATION_FAILED';
}

/** 서버에 닿지 못한 경우(BE 꺼짐·주소 오류·CORS 차단·오프라인). fetch 는 이때 TypeError 를 던져요. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

export const NETWORK_ERROR_MESSAGE = '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';

/** 회원가입 실패를 어느 칸에 어떤 문구로 보여줄지 정합니다. */
export function getSignupErrorMessage(error: unknown): { email?: string; form?: string } {
  if (isNetworkError(error)) return { form: NETWORK_ERROR_MESSAGE };
  if (!(error instanceof ApiError)) return { form: '회원가입하지 못했어요. 잠시 후 다시 시도해 주세요.' };
  // 확정 계약: 409 EMAIL_ALREADY_EXISTS. 상태 코드만 와도 같은 안내를 보여줘요.
  if (getErrorCode(error) === 'EMAIL_ALREADY_EXISTS' || error.status === 409) return { email: '이미 가입된 이메일이에요.' };
  // 400: 서버 검증 실패(형식·길이). 메시지에는 입력값이 담기지 않아요.
  if (error.status === 400) return { form: '이메일 형식과 비밀번호(15~64자)를 다시 확인해 주세요.' };
  return { form: '회원가입하지 못했어요. 잠시 후 다시 시도해 주세요.' };
}

export const SESSION_EXPIRED_PATH = '/error/session-expired';

/**
 * 재로그인 후 돌아갈 화면. 401 이 나면 이렇게 이동해 주세요 (입력값 유지를 위해 navigate 만 사용):
 * clearAccessToken(); navigate(SESSION_EXPIRED_PATH, { state: { from: '/grade/confirm' } });
 */
export type ReturnToState = { from?: string };

/** location.state 의 from 이 앱 안쪽 경로일 때만 돌려줍니다. */
export function getReturnTo(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const { from } = state as Record<string, unknown>;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : null;
}
