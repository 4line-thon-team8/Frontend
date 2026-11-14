// accessToken 은 메모리에만 보관합니다 (localStorage·쿠키 저장 없음). 새로고침하면 로그인이 풀려요.
// BE 기준: 불투명한 랜덤 토큰, 발급 2시간 뒤 만료(expiresAt, UTC ISO 문자열), refresh·자동 연장 없음.

/** 만료 직전 요청이 서버에서 401 이 되지 않도록 30초 일찍 만료로 봅니다. */
const EXPIRY_MARGIN_MS = 30_000;

let accessToken: string | null = null;
let expiresAtMs: number | null = null;

/** 로그인 성공 시 호출합니다. expiresAt 은 로그인 응답의 절대 시각(ISO 문자열)입니다. */
export function setAccessToken(token: string, expiresAt: string) {
  const parsed = Date.parse(expiresAt);
  if (!token || Number.isNaN(parsed)) throw new Error('로그인 토큰 정보가 올바르지 않아요.');
  accessToken = token;
  expiresAtMs = parsed;
}

/** 토큰이 없거나 만료됐으면 null. 분석 요청 전에 null 이면 요청하지 말고 재로그인으로 보내 주세요. */
export function getAccessToken(): string | null {
  if (!accessToken || expiresAtMs === null) return null;
  if (Date.now() >= expiresAtMs - EXPIRY_MARGIN_MS) {
    clearAccessToken();
    return null;
  }
  return accessToken;
}

/** 로그아웃이나 401(UNAUTHORIZED) 때 호출합니다. */
export function clearAccessToken() {
  accessToken = null;
  expiresAtMs = null;
}

/** fetch headers 에 펼쳐 쓰는 Authorization 헤더. 토큰이 없으면 빈 객체예요. */
export function getAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
