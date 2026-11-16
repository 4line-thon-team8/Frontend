// FE2: GET /api/reports, DELETE /api/reports/{report_id}
// TODO: GET /api/reports/{report_id} 는 명세 받으면 추가합니다.
import { ApiError, apiClient } from './apiClient';
import { USE_MOCK_AUTH } from './authApi';
import { getAccessToken } from './authToken';
import { MOCK_SAVED_REPORTS } from '../pages/mypage/mypage.mock';

/** 저장 리포트 목록 항목. 명세상 reportId·createdAt 만 와요 (추천 원서 요약은 미정). */
export type ReportSummary = {
  /** 형식 미정이라 문자열로 맞춰 둡니다. */
  reportId: string;
  /** ISO-8601 (예: 2026-11-01T09:00:00+09:00) */
  createdAt: string;
};

/** 토큰이 없거나 만료돼서 요청하지 않았을 때. 화면에서 세션 만료로 보내요. */
export class NoTokenError extends Error {
  constructor() {
    super('로그인이 필요해요.');
    this.name = 'NoTokenError';
  }
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (!token) throw new NoTokenError();
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

function toReportSummary(item: unknown): ReportSummary | null {
  if (typeof item !== 'object' || item === null) return null;
  const { reportId, createdAt } = item as Record<string, unknown>;
  const id = typeof reportId === 'string' || typeof reportId === 'number' ? String(reportId) : '';
  if (!id || typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null;
  return { reportId: id, createdAt };
}

/** GET /api/reports → { reports: ReportSummary[] }. 서버가 최신순으로 정렬해서 줘요. */
export async function getReports(): Promise<ReportSummary[]> {
  if (USE_MOCK_AUTH) {
    return MOCK_SAVED_REPORTS.map(report => ({ reportId: report.id, createdAt: report.createdAtIso }));
  }
  const body = await apiClient('/api/reports', { headers: authHeaders() });
  const reports = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).reports : undefined;
  if (!Array.isArray(reports)) throw new Error('리포트 목록 응답 형식이 올바르지 않아요.');
  // 형식이 어긋난 항목 하나 때문에 목록 전체가 안 보이지 않도록 건너뛰어요.
  return reports.map(toReportSummary).filter((report): report is ReportSummary => report !== null);
}

/**
 * DELETE /api/reports/{report_id} → 204, 본문 없음. 본인 리포트만 지울 수 있어요.
 * 404(이미 없는 리포트)는 지우려던 결과와 같으니 성공으로 봐요. 401·403·그 외는 그대로 던집니다.
 */
export async function deleteReport(reportId: string): Promise<void> {
  if (USE_MOCK_AUTH) return;
  try {
    await apiClient(`/api/reports/${encodeURIComponent(reportId)}`, { method: 'DELETE', headers: authHeaders() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return;
    throw error;
  }
}

/** 삭제 전 확인 문구 (F-16: 삭제하면 복구할 수 없다는 안내는 FE 가 보여줘요) */
export const DELETE_REPORT_CONFIRM = '이 리포트를 삭제할까요?\n삭제하면 복구할 수 없어요.';

/** 삭제 실패 문구. 401 은 화면에서 세션 만료로 따로 처리해요. */
export function getDeleteReportErrorMessage(error: unknown): string {
  if (error instanceof TypeError) return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
  if (error instanceof ApiError && error.status === 403) return '이 리포트는 삭제할 수 없어요.';
  return '리포트를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

/** 화면 표기: 한국 시간 기준 YYYY.MM.DD */
export function formatReportDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(iso));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')}`;
}

/** 화면 표기: 한국 시간 기준 오전/오후 h:mm */
export function formatReportTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}
