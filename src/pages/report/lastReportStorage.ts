import type { SaveStatus } from '../../services/simulationApi';
import type { Recommendation, ResultWarning } from './recommendation.mock';
import { toApplicationTier } from './reportTier';

/**
 * 하단 '리포트' 탭으로 다시 볼 마지막 리포트. 새로고침해도 남도록 sessionStorage 에 둬요(탭을 닫으면 사라져요).
 *
 * 기획 결정(2026-11-18): 입력한 성적·환산 결과·서술 분석은 브라우저에 남기지 않아요.
 * 총평·지원 전략 같은 리포트 문장도 남기지 않아요. 남기는 건 추천 원서 목록·안내 코드·저장 결과·요약 카드 문구뿐이에요.
 */
export type StoredReport = {
  recommendations: Recommendation[];
  warnings: ResultWarning[];
  saveStatus: SaveStatus | null;
  /** 요약 카드: '컴퓨터공학 · 통계학 희망', '학생부교과 선호' */
  profileLines: string[];
};

const STORAGE_KEY = 'odeunggeup:last-report:v1';
const SAVE_STATUSES: readonly SaveStatus[] = ['SAVED', 'FAILED', 'NOT_SAVED'];

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';

function toRecommendation(item: unknown): Recommendation | null {
  if (!isObject(item) || typeof item.rank !== 'number' || !isString(item.university) || !isString(item.major)) return null;
  const reasonText = isObject(item.reason) && isString(item.reason.text) ? item.reason.text : '';
  return {
    rank: item.rank,
    university: item.university,
    major: item.major,
    admission: isString(item.admission) ? item.admission : '',
    tier: toApplicationTier(item.tier),
    reason: { text: reasonText },
    evidence: isString(item.evidence) ? item.evidence : '',
  };
}

function toWarning(item: unknown): ResultWarning | null {
  if (!isObject(item) || !isString(item.code) || !isString(item.message)) return null;
  return { code: item.code, message: item.message, rank: typeof item.rank === 'number' ? item.rank : null };
}

const compact = <T,>(items: unknown, map: (item: unknown) => T | null): T[] =>
  Array.isArray(items) ? items.map(map).filter((item): item is T => item !== null) : [];

/** 저장할 값만 골라 담아요. 다른 필드가 섞여 들어와도 저장되지 않아요. */
export function saveLastReport(report: StoredReport): void {
  const stored: StoredReport = {
    recommendations: report.recommendations.map(({ rank, university, major, admission, tier, reason, evidence }) => ({
      rank, university, major, admission, tier, reason: { text: reason.text }, evidence,
    })),
    warnings: report.warnings.map(({ code, message, rank }) => ({ code, message, rank })),
    saveStatus: report.saveStatus,
    profileLines: [...report.profileLines],
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // 저장소를 못 쓰면(사생활 보호 모드 등) 이번 화면에서만 볼 수 있어요.
  }
}

export function loadLastReport(): StoredReport | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const body: unknown = JSON.parse(raw);
    if (!isObject(body)) return null;
    return {
      recommendations: compact(body.recommendations, toRecommendation),
      warnings: compact(body.warnings, toWarning),
      saveStatus: SAVE_STATUSES.find(status => status === body.saveStatus) ?? null,
      profileLines: Array.isArray(body.profileLines) ? body.profileLines.filter(isString) : [],
    };
  } catch {
    return null;
  }
}

export function clearLastReport(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소를 못 쓰면 지울 것도 없어요.
  }
}
