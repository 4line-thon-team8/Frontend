// FE2: GET /api/reports, GET·DELETE /api/reports/{report_id}
import { ApiError, apiClient } from './apiClient';
import { USE_MOCK_AUTH } from './authApi';
import { getAccessToken } from './authToken';
import { MOCK_SAVED_REPORTS } from '../pages/mypage/mypage.mock';
import { MOCK_RECOMMENDATIONS } from '../pages/report/recommendation.mock';

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
  // 명세는 reportId 지만, 서버가 id 로 줄 때도 받아요.
  const { reportId = (item as Record<string, unknown>).id, createdAt } = item as Record<string, unknown>;
  const id = typeof reportId === 'string' || typeof reportId === 'number' ? String(reportId) : '';
  // 시각을 읽을 수 없어도 리포트는 보여줘요(목록에서 사라지는 것보다 나아요). 표시는 화면에서 처리해요.
  if (!id) return null;
  return { reportId: id, createdAt: typeof createdAt === 'string' ? createdAt : '' };
}

/** 목록 배열 찾기: 명세 { reports: [...] }. 배열을 바로 주거나 content/items 로 감싼 경우도 받아요. */
function findReportList(body: unknown): unknown[] | undefined {
  if (Array.isArray(body)) return body;
  if (typeof body !== 'object' || body === null) return undefined;
  const { reports, content, items } = body as Record<string, unknown>;
  return [reports, content, items].find(Array.isArray);
}

/** GET /api/reports → { reports: ReportSummary[] }. 서버가 최신순으로 정렬해서 줘요. */
export async function getReports(): Promise<ReportSummary[]> {
  if (USE_MOCK_AUTH) {
    return MOCK_SAVED_REPORTS.map(report => ({ reportId: report.id, createdAt: report.createdAtIso }));
  }
  const body = await apiClient('/api/reports', { headers: authHeaders() });
  const reports = findReportList(body);
  if (import.meta.env.DEV) console.info('[리포트 목록 응답]', body);
  if (!reports) throw new Error('리포트 목록 응답 형식이 올바르지 않아요.');
  // 형식이 어긋난 항목 하나 때문에 목록 전체가 안 보이지 않도록 건너뛰어요.
  return reports.map(toReportSummary).filter((report): report is ReportSummary => report !== null);
}

/** 저장된 추천 원서 1장. 명세상 지망·대학·학과·전형·구분·추천 이유만 저장돼요. */
export type SavedRecommendation = {
  /** 지망 번호. 필수 여부 미정이라 없으면 순서대로 매겨요. */
  rank: number;
  university: string;
  department: string;
  admissionType: string;
  /** 구분 라벨. 필수·형식 미정이라 없으면 null */
  category: string | null;
  reasonText: string;
};

export type SavedReportDetail = {
  reportId: string;
  createdAt: string;
  recommendations: SavedRecommendation[];
};

function toSavedRecommendation(item: unknown, index: number): SavedRecommendation | null {
  if (typeof item !== 'object' || item === null) return null;
  // BE 저장본(RecommendationDetail)은 분석 응답과 필드 이름이 달라요:
  // universityName·deptName·trackName·label, reason 은 문자열. 분석 응답 이름(university 등)도 함께 받아요.
  const record = item as Record<string, unknown>;
  const rank = record.rank;
  const university = record.universityName ?? record.university;
  const department = record.deptName ?? record.department;
  const admissionType = record.trackName ?? record.admissionType;
  const category = record.label ?? record.category;
  const reason = record.reason;
  const reasonText = typeof reason === 'string' ? reason
    : typeof reason === 'object' && reason !== null ? (reason as Record<string, unknown>).text : undefined;
  if (typeof university !== 'string' || typeof department !== 'string') return null;
  return {
    rank: typeof rank === 'number' && Number.isFinite(rank) ? rank : index + 1,
    university,
    department,
    admissionType: typeof admissionType === 'string' ? admissionType : '',
    category: typeof category === 'string' && category !== '' ? category : null,
    reasonText: typeof reasonText === 'string' ? reasonText : '',
  };
}

/** GET /api/reports/{report_id} → 저장본 (인사·총평·전략·성적은 저장하지 않아서 없어요) */
export async function getReport(reportId: string): Promise<SavedReportDetail> {
  if (USE_MOCK_AUTH) {
    const mock = MOCK_SAVED_REPORTS.find(report => report.id === reportId);
    if (!mock) throw new ApiError(404, { code: 'NOT_FOUND' });
    return {
      reportId,
      createdAt: mock.createdAtIso,
      recommendations: MOCK_RECOMMENDATIONS.map(item => ({
        rank: item.rank,
        university: item.university,
        department: item.major,
        admissionType: item.admission,
        category: item.tier,
        reasonText: item.reason.text,
      })),
    };
  }
  const body = await apiClient(`/api/reports/${encodeURIComponent(reportId)}`, { headers: authHeaders() });
  const summary = toReportSummary(body);
  const list = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).recommendations : undefined;
  if (!summary || !Array.isArray(list)) throw new Error('리포트 응답 형식이 올바르지 않아요.');
  return {
    ...summary,
    recommendations: list
      .map(toSavedRecommendation)
      .filter((item): item is SavedRecommendation => item !== null)
      .sort((a, b) => a.rank - b.rank),
  };
}

/** 상세 조회 실패 문구. 401 은 화면에서 세션 만료로 따로 처리해요. */
export function getReportErrorMessage(error: unknown): string {
  if (error instanceof TypeError) return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
  if (error instanceof ApiError && error.status === 404) return '리포트를 찾을 수 없어요. 이미 삭제됐을 수 있어요.';
  if (error instanceof ApiError && error.status === 403) return '이 리포트는 볼 수 없어요.';
  return '리포트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
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
export const DELETE_REPORT_CONFIRM = {
  title: '이 리포트를 삭제할까요?',
  description: '삭제한 리포트는 다시 복구할 수 없어요.',
  confirmLabel: '삭제하기',
} as const;

/** 삭제 실패 문구. 401 은 화면에서 세션 만료로 따로 처리해요. */
export function getDeleteReportErrorMessage(error: unknown): string {
  if (error instanceof TypeError) return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
  if (error instanceof ApiError && error.status === 403) return '이 리포트는 삭제할 수 없어요.';
  return '리포트를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

/** 화면 표기: 한국 시간 기준 YYYY.MM.DD */
export function formatReportDate(iso: string): string {
  if (Number.isNaN(Date.parse(iso))) return '날짜 확인 중';
  const parts = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(iso));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')}`;
}

/** 화면 표기: 한국 시간 기준 오전/오후 h:mm */
export function formatReportTime(iso: string): string {
  if (Number.isNaN(Date.parse(iso))) return '저장된 리포트';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}
