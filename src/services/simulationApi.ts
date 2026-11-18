// FE: POST /api/simulations (성적·지원 방향 → 환산·추천·리포트)
import type { GradeAnalysisSnapshot } from '../app/gradeAnalysisContext';
import type { AdmissionPreference, GradeConfirmDraft } from '../types/gradeConfirm';
import { reviewSubject } from '../utils/gradeConfirmValidation';
import { apiClient } from './apiClient';
import { USE_MOCK_AUTH } from './authApi';
import { getAccessToken } from './authToken';
import { NoTokenError } from './reportApi';
import { createMockSimulationResult } from '../pages/report/recommendation.mock';

export interface SimulationSubjectRow {
  subjectRef: string;
  subjectCode: string;
  gradeValue: number;
}

export function toSimulationSubjectRows(draft: GradeConfirmDraft): SimulationSubjectRow[] | null {
  const rows: SimulationSubjectRow[] = [];
  for (const subject of draft.subjects) {
    const review = reviewSubject(subject, draft.curriculum);
    if (review.status === 'review') return null;
    if (review.status === 'included') {
      rows.push({
        subjectRef: `row-${rows.length + 1}`,
        subjectCode: review.subjectCode,
        gradeValue: review.gradeValue,
      });
    }
  }
  return rows.length ? rows : null;
}

/* ---------- 요청 ---------- */

/**
 * 선호 전형 → preferredTrack 코드 (BE 재원님 확인, 2026-11-16).
 * 정시 코드는 BE·기획 확인 중이에요. 화면에 정시 선택지가 없어서 지금은 보낼 일이 없고,
 * 정시가 추가돼 400 이 나면 확정 전까지 ANY 로 보내기로 했어요.
 */
const TRACK_CODES: Record<AdmissionPreference, string> = {
  'school-record': 'SUBJECT',
  comprehensive: 'HOLISTIC',
  any: 'ANY',
};

function toPreferredTrack(admissions: readonly AdmissionPreference[]): string {
  // 교과·학종을 둘 다 고르면(또는 아무것도 없으면) 상관없음과 같아요.
  const [only] = admissions;
  return admissions.length === 1 && only ? TRACK_CODES[only] : TRACK_CODES.any;
}

function toRequestBody(snapshot: GradeAnalysisSnapshot) {
  const { preferences } = snapshot;
  const preferredTrack = toPreferredTrack(preferences.admissions);
  return {
    // 과목 행은 subjectRef·subjectCode·gradeValue 만 보내요. (gradeSystem·credits 는 이번 배포 API 에 넣지 않기로 함)
    subjects: snapshot.subjects.map(({ subjectRef, subjectCode, gradeValue }) => ({ subjectRef, subjectCode, gradeValue })),
    applicationPreference: {
      desiredMajorCodes: [...preferences.majorIds],
      preferredTrack,
      includeReachCard: preferences.includeReach,
      allowSimilarMajors: preferences.expandSimilarMajors,
    },
    // 분석하기 버튼을 누른 것 = 분석 동의 (false 면 서버가 400 으로 거부)
    analysisConsent: true,
    // 서술 분석은 읽었을 때만 보내요. 키를 빼면 성적만으로 분석해요. 서술 전문은 보내지 않아요.
    ...(snapshot.holisticAnalysis ? { holisticAnalysis: snapshot.holisticAnalysis } : {}),
  };
}

/** 새 분석마다 만드는 중복 저장 방지 키. 같은 분석을 다시 보낼 때는 같은 키를 써요. */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/* ---------- 응답 ---------- */

export type ReportSection = { text: string; generationMethod: string };

export type SimulationRecommendation = {
  rank: number;
  university: string;
  department: string;
  admissionType: string;
  /** 성적만으로 본 구간. SAFE·MATCH·REACH·FAR·OVER·UNRATED (필수 여부 미정이라 없으면 null) */
  category: string | null;
  /** 서류를 반영해 조정한 구간(SAFE·MATCH·REACH). 서류 보정을 적용한 카드만 값이 있어요. */
  overallCategory: string | null;
  /** 서류 적합도. 학종 후보에 서류 입력이 있을 때만 값이 있어요. */
  documentFit: DocumentFit | null;
  reason: ReportSection;
  /** 근거 지표. 필드가 아직 초안이라 받은 그대로 둬요. */
  evidence: Record<string, unknown> | null;
};

export type DocumentFitLevel = 'HIGH' | 'MID' | 'LOW';

export type DocumentFit = {
  level: DocumentFitLevel;
  /** 판단에 크게 작용한 평가요소(ACADEMIC·MAJOR_FIT·COMMUNITY). 최대 2개 */
  basis: string[];
};

/** 서술 분석 반영 결과. 보내지 않았으면 NOT_PROVIDED. 서버에 저장되지 않는 값이에요. */
export type HolisticResult = {
  status: 'APPLIED' | 'SKIPPED' | 'NOT_PROVIDED';
  /** SKIPPED 일 때: DISABLED·RULES_OUTDATED·TOO_SHORT·INSUFFICIENT_SIGNALS */
  skipReason: string | null;
};

/** 강점 지표 하나. indicatorId 는 /api/holistic-rules 의 지표 ID(A3 등), level 은 1~5 (실제로는 4·5만 와요). */
export type HolisticStrength = { indicatorId: string; label: string; level: number; description: string };
export type HolisticMajorAdvice = { department: string; advice: string };

/**
 * 활동·지원 전략 화면 위쪽 세 영역 (BE holistic.activitySummary·strengths·majorAdvices).
 * 서버에 저장되지 않는 값이에요. SKIPPED·NOT_PROVIDED 이거나 필드가 없으면 null·빈 배열 → 화면에서 숨겨요.
 * BE 단계별 배포: 1단계에는 strengths 만 오고 activitySummary 는 null, majorAdvices 는 [] 예요.
 */
export type HolisticStrategy = {
  activitySummary: string | null;
  /** 강한 순서 최대 3개 */
  strengths: HolisticStrength[];
  /** 희망 학과 입력 순서, 최대 3개 */
  majorAdvices: HolisticMajorAdvice[];
};

/** 추천 안내. 서버는 code·rank 만 보내고, 화면 문구는 FE 가 정해요. */
export type SimulationWarning = { code: string; rank: number | null };

export type SaveStatus = 'SAVED' | 'FAILED' | 'NOT_SAVED';

export type SimulationResult = {
  conversion: {
    overallGrade: number | null;
    isAssumed: boolean;
    assumptionReasons: { code: string; message: string; subjectRef: string | null }[];
  };
  recommendations: SimulationRecommendation[];
  holistic: HolisticResult;
  /** holistic 응답에서 읽은 활동 요약·강점·학과별 조언 */
  holisticStrategy: HolisticStrategy;
  report: {
    greetingSummary: ReportSection | null;
    overallAssessment: ReportSection | null;
    applicationStrategy: ReportSection | null;
    closing: ReportSection | null;
  };
  warnings: SimulationWarning[];
  /** 필드 미정이라 없으면 null (화면에 '저장 완료'를 단정하지 않아요) */
  saveStatus: SaveStatus | null;
  reportId: string | null;
};

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown) => (typeof value === 'string' ? value : '');

function toSection(value: unknown): ReportSection | null {
  if (!isObject(value) || typeof value.text !== 'string' || !value.text.trim()) return null;
  return { text: value.text, generationMethod: str(value.generationMethod) };
}

function toRecommendation(item: unknown, index: number): SimulationRecommendation | null {
  if (!isObject(item) || typeof item.university !== 'string' || typeof item.department !== 'string') return null;
  return {
    rank: typeof item.rank === 'number' && Number.isFinite(item.rank) ? item.rank : index + 1,
    university: item.university,
    department: item.department,
    admissionType: str(item.admissionType),
    category: typeof item.category === 'string' && item.category ? item.category : null,
    overallCategory: typeof item.overallCategory === 'string' && item.overallCategory ? item.overallCategory : null,
    documentFit: toDocumentFit(item.documentFit),
    reason: toSection(item.reason) ?? { text: '', generationMethod: '' },
    evidence: isObject(item.evidence) ? item.evidence : null,
  };
}

const FIT_LEVELS: readonly string[] = ['HIGH', 'MID', 'LOW'];

function toDocumentFit(value: unknown): DocumentFit | null {
  if (!isObject(value) || typeof value.level !== 'string' || !FIT_LEVELS.includes(value.level)) return null;
  const basis = Array.isArray(value.basis) ? value.basis.filter((item): item is string => typeof item === 'string') : [];
  return { level: value.level as DocumentFitLevel, basis };
}

function toHolistic(value: unknown): HolisticResult {
  if (!isObject(value)) return { status: 'NOT_PROVIDED', skipReason: null };
  const status = value.status === 'APPLIED' || value.status === 'SKIPPED' ? value.status : 'NOT_PROVIDED';
  return { status, skipReason: status === 'SKIPPED' && typeof value.skipReason === 'string' ? value.skipReason : null };
}

const MAX_STRATEGY_ITEMS = 3;
const textOf = (value: unknown) => (isObject(value) && typeof value.text === 'string' ? value.text.trim() : '');

function toHolisticStrategy(value: unknown): HolisticStrategy {
  const empty: HolisticStrategy = { activitySummary: null, strengths: [], majorAdvices: [] };
  if (!isObject(value) || value.status !== 'APPLIED') return empty;
  const strengths = Array.isArray(value.strengths)
    ? value.strengths.flatMap((item): HolisticStrength[] => {
      if (!isObject(item) || typeof item.label !== 'string' || !item.label.trim()) return [];
      if (typeof item.level !== 'number' || !Number.isFinite(item.level)) return [];
      return [{
        indicatorId: str(item.indicatorId) || item.label,
        label: item.label,
        level: Math.min(5, Math.max(1, Math.round(item.level))),
        description: str(item.description),
      }];
    })
    : [];
  const majorAdvices = Array.isArray(value.majorAdvices)
    ? value.majorAdvices.flatMap((item): HolisticMajorAdvice[] => {
      if (!isObject(item) || typeof item.department !== 'string') return [];
      const advice = textOf(item.advice);
      return advice ? [{ department: item.department, advice }] : [];
    })
    : [];
  return {
    activitySummary: textOf(value.activitySummary) || null,
    strengths: strengths.slice(0, MAX_STRATEGY_ITEMS),
    majorAdvices: majorAdvices.slice(0, MAX_STRATEGY_ITEMS),
  };
}

function toWarnings(value: unknown): SimulationWarning[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => (isObject(item) && typeof item.code === 'string'
    ? [{ code: item.code, rank: typeof item.rank === 'number' ? item.rank : null }]
    : []));
}

function toAssumptionReasons(value: unknown): SimulationResult['conversion']['assumptionReasons'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => (isObject(item) && typeof item.message === 'string'
    ? [{ code: str(item.code), message: item.message, subjectRef: typeof item.subjectRef === 'string' ? item.subjectRef : null }]
    : []));
}

function toSaveStatus(body: Json): { saveStatus: SaveStatus | null; reportId: string | null } {
  // 필드 이름이 미정이라 saveStatus 가 문자열이거나 { status, reportId } 객체인 경우를 모두 받아요.
  const raw = body.saveStatus;
  const status = isObject(raw) ? raw.status : raw;
  const id = isObject(raw) ? raw.reportId : body.reportId;
  return {
    saveStatus: status === 'SAVED' || status === 'FAILED' || status === 'NOT_SAVED' ? status : null,
    reportId: typeof id === 'string' || typeof id === 'number' ? String(id) : null,
  };
}

export function parseSimulationResult(body: unknown): SimulationResult {
  if (!isObject(body) || !Array.isArray(body.recommendations)) throw new Error('분석 응답 형식이 올바르지 않아요.');
  const conversion = isObject(body.conversion) ? body.conversion : {};
  const report = isObject(body.report) ? body.report : {};
  return {
    conversion: {
      overallGrade: typeof conversion.overallGrade === 'number' ? conversion.overallGrade : null,
      isAssumed: conversion.isAssumed === true,
      assumptionReasons: toAssumptionReasons(conversion.assumptionReasons),
    },
    holistic: toHolistic(body.holistic),
    holisticStrategy: toHolisticStrategy(body.holistic),
    // 카드 순서·rank 는 서버 결과 그대로 (지망 순서로만 정렬)
    recommendations: body.recommendations
      .map(toRecommendation)
      .filter((item): item is SimulationRecommendation => item !== null)
      .sort((a, b) => a.rank - b.rank),
    report: {
      greetingSummary: toSection(report.greetingSummary),
      overallAssessment: toSection(report.overallAssessment),
      applicationStrategy: toSection(report.applicationStrategy),
      closing: toSection(report.closing),
    },
    warnings: toWarnings(body.warnings),
    ...toSaveStatus(body),
  };
}

/* ---------- 호출 ---------- */

/**
 * POST /api/simulations. 로그인 토큰(Bearer)과 Idempotency-Key 를 함께 보내요.
 * - 401: 서버는 분석·저장을 시작하지 않았어요. 재로그인 후 같은 키로 다시 보내면 돼요.
 * - 토큰이 없거나 만료됐으면 요청하지 않고 NoTokenError 를 던져요.
 */
export async function runSimulation(snapshot: GradeAnalysisSnapshot, signal?: AbortSignal): Promise<SimulationResult> {
  if (USE_MOCK_AUTH) return createMockSimulationResult();
  const token = getAccessToken();
  if (!token) throw new NoTokenError();
  const body = await apiClient('/api/simulations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': snapshot.idempotencyKey,
    },
    body: JSON.stringify(toRequestBody(snapshot)),
    signal,
  });
  const result = parseSimulationResult(body);
  if (import.meta.env.DEV) logGenerationMethods(result);
  return result;
}

/**
 * 개발 서버에서만: 섹션별 generationMethod(llm/template)와 저장 결과를 콘솔에 보여줘요.
 * BE 연동 테스트용이에요. 문장·성적 같은 내용은 찍지 않아요. 배포 빌드에서는 빠져요.
 */
function logGenerationMethods(result: SimulationResult) {
  const { report } = result;
  console.info('[분석 응답] 저장 결과:', result.saveStatus ?? '(응답에 없음)', '/ reportId:', result.reportId ?? '-');
  console.table({
    인사: report.greetingSummary?.generationMethod ?? '(없음)',
    총평: report.overallAssessment?.generationMethod ?? '(없음)',
    지원전략: report.applicationStrategy?.generationMethod ?? '(없음)',
    마무리: report.closing?.generationMethod ?? '(없음)',
    ...Object.fromEntries(result.recommendations.map(item => [`${item.rank}지망 이유`, item.reason.generationMethod || '(없음)'])),
  });
}
