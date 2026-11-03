const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API 요청 실패 (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// 반환값은 unknown: API 명세 확정 후 서비스 계층에서 검증/타입을 정의합니다.
// JSON 직렬화, FormData, 인증 방식은 호출자가 명세에 따라 설정합니다.
export async function apiClient(path: `/api/${string}`, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body: unknown = text || undefined;
  if (text && response.headers.get('content-type')?.includes('application/json')) {
    try { body = JSON.parse(text) as unknown; }
    catch {
      if (response.ok) throw new Error('API 응답이 올바른 JSON 형식이 아닙니다.');
    }
  }
  if (!response.ok) throw new ApiError(response.status, body);
  return body;
}
