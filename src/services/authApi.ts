// FE2: POST /api/auth/signup, /api/auth/login, /api/auth/logout
// TODO: DELETE /api/users/me (회원 탈퇴)는 명세 확정 후 추가합니다.
import { ApiError, apiClient } from './apiClient';
import { clearAccessToken, getAccessToken, setAccessToken } from './authToken';

/** BE 주소(VITE_API_BASE_URL)가 없으면 시연용 목 로그인으로 동작합니다. */
export const USE_MOCK_AUTH = !import.meta.env.VITE_API_BASE_URL;

const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;

export type Credentials = { email: string; password: string };
type LoginResponse = { accessToken: string; expiresAt: string };

function postJson(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function isLoginResponse(body: unknown): body is LoginResponse {
  if (typeof body !== 'object' || body === null) return false;
  const { accessToken, expiresAt } = body as Record<string, unknown>;
  return typeof accessToken === 'string' && accessToken !== '' && typeof expiresAt === 'string';
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
  setAccessToken(body.accessToken, body.expiresAt);
}

/** 204. 현재 토큰만 폐기돼요. 서버 요청이 실패해도 이 기기에서는 로그아웃 처리합니다. */
export async function logout(): Promise<void> {
  const token = getAccessToken();
  clearAccessToken();
  if (USE_MOCK_AUTH || !token) return;
  try {
    await apiClient('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // 토큰은 이미 메모리에서 지웠고, 만료되면 서버에서도 쓸 수 없어요.
  }
}

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
