import { useGradeAnalysis, type GradeAnalysisSnapshot } from '../../app/gradeAnalysisContext';
import type { StoredReport } from './lastReportStorage';
import { USE_MOCK_AUTH } from '../../services/authApi';
import type { HolisticStrategy, ReportSection, SaveStatus, SimulationResult, SimulationWarning } from '../../services/simulationApi';
import { createMockSimulationResult, useMockRecommendationResult } from './recommendation.mock';
import type { Recommendation, RecommendationResult, ResultWarning } from './recommendation.mock';
import { toApplicationTier } from './reportTier';

/**
 * 추천 안내 코드 → 화면 문구. 서버는 code·rank 만 보내고 문구는 기획·FE 가 정해요.
 * 목록에 없는 코드는 화면에 띄우지 않아요(코드 문자열이 그대로 보이지 않도록).
 * FEWER_THAN_SIX_CARDS·NO_CANDIDATES 는 장수 안내·0장 화면으로 따로 보여줘요.
 */
const WARNING_MESSAGES: Record<string, string> = {
  NO_CANDIDATES: '현재 조건에서 추천 가능한 후보가 없어요.',
  FEWER_THAN_SIX_CARDS: '현재 조건에서 추천 가능한 후보가 6장보다 적어요.',
  REACH_CARD_NOT_AVAILABLE: '상향 지원 카드로 넣을 후보를 찾지 못했어요.',
  SIMILAR_MAJOR_USED: '희망 학과와 비슷한 학과로 채운 카드예요.',
  OTHER_TRACK_USED: '선호 전형이 아닌 전형으로 채운 카드예요.',
  UNDECLARED_USED: '자율전공·무전공 학과로 채운 카드예요.',
  UNRATED_CARD: '입결 자료가 없어 구간을 판단하기 어려워요.',
  LOW_CONFIDENCE_CARD: '참고할 입결 자료가 적어 결과가 불확실해요.',
  HOLISTIC_SKIPPED: '생기부 서술은 이번 결과에 반영하지 못해 성적만으로 추천했어요.',
};

function toWarnings(warnings: SimulationWarning[]): ResultWarning[] {
  return warnings.flatMap(warning => {
    const message = WARNING_MESSAGES[warning.code];
    return message ? [{ code: warning.code, message, rank: warning.rank }] : [];
  });
}

/** 근거 지표(초안 필드)를 한 줄로. 값이 없으면 빈 문자열 → 화면에서 근거 줄을 숨겨요. */
function toEvidenceText(evidence: Record<string, unknown> | null): string {
  if (!evidence) return '';
  const parts: string[] = [];
  if (typeof evidence.quota === 'number') parts.push(`모집 인원 ${evidence.quota}명`);
  if (typeof evidence.competitionRate === 'number') parts.push(`경쟁률 ${evidence.competitionRate}:1`);
  if (typeof evidence.basisYears === 'number' && evidence.basisYears > 0) parts.push(`최근 ${evidence.basisYears}개년 입결 기준`);
  if (evidence.isNewOrMergedDepartment === true || evidence.newOrMergedDepartment === true) parts.push('신설·통합 학과');
  return parts.join(' · ');
}

function toRecommendationResult(result: SimulationResult): RecommendationResult {
  return {
    recommendations: result.recommendations.map((item): Recommendation => ({
      rank: item.rank,
      university: item.university,
      major: item.department,
      admission: item.admissionType,
      tier: toApplicationTier(item.category),
      reason: { text: item.reason.text },
      evidence: toEvidenceText(item.evidence),
    })),
    warnings: toWarnings(result.warnings),
  };
}

export type ReportView = RecommendationResult & {
  report: SimulationResult['report'];
  /** 활동·지원 전략 화면 위쪽: 활동 요약·강점·학과별 조언 (비어 있으면 영역을 숨겨요) */
  holisticStrategy: HolisticStrategy;
  saveStatus: SaveStatus | null;
  /** 요약 카드: 희망 학과 / 선호 전형 (분석에 보낸 값 그대로) */
  profileLines: string[];
};

const ADMISSION_LABELS: Record<string, string> = { 'school-record': '학생부교과', comprehensive: '학생부종합', any: '상관없음' };

function toProfileLines(snapshot: GradeAnalysisSnapshot | null): string[] {
  const majorNames = snapshot?.majorNames ?? [];
  const admissions = snapshot?.preferences.admissions.map(id => ADMISSION_LABELS[id] ?? id) ?? [];
  return [
    majorNames.length ? `${majorNames.join(' · ')} 희망` : '',
    admissions.length ? `${admissions.join(' · ')} 선호` : '',
  ].filter(Boolean);
}

/** 하단 '리포트' 탭용으로 남길 값. 성적·환산 결과·서술 분석·리포트 문장은 담지 않아요. */
export function toStoredReport(result: SimulationResult, snapshot: GradeAnalysisSnapshot | null): StoredReport {
  return { ...toRecommendationResult(result), saveStatus: result.saveStatus, profileLines: toProfileLines(snapshot) };
}

const NO_REPORT_TEXT: SimulationResult['report'] = { greetingSummary: null, overallAssessment: null, applicationStrategy: null, closing: null };
const NO_HOLISTIC_STRATEGY: HolisticStrategy = { activitySummary: null, strengths: [], majorAdvices: [] };

/**
 * 리포트 화면 데이터. 분석 응답(GradeAnalysisProvider.result)을 화면 모양으로 바꿔요.
 * - 방금 끝난 분석이 없으면(홈·마이페이지를 다녀온 경우) 마지막 리포트(lastReport)를 보여줘요.
 *   리포트 문장은 메모리에만 있어서, 새로고침한 뒤에는 총평·전략 문단만 빠져요.
 * - 둘 다 없으면 null → 화면에서 성적 입력으로 보내요.
 * - BE 주소가 없는 시연 모드에서는 목업을 보여줘요 (?mock=partial / ?mock=empty 지원).
 */
export function useReportView(): ReportView | null {
  const { result, snapshot, lastReport, lastReportText } = useGradeAnalysis();
  const mockRecommendations = useMockRecommendationResult();

  if (result) return { ...toStoredReport(result, snapshot), report: result.report, holisticStrategy: result.holisticStrategy };
  if (lastReport) {
    return {
      ...lastReport,
      report: lastReportText?.report ?? NO_REPORT_TEXT,
      holisticStrategy: lastReportText?.holisticStrategy ?? NO_HOLISTIC_STRATEGY,
    };
  }
  if (!USE_MOCK_AUTH) return null;
  const mock = createMockSimulationResult();
  const profileLines = toProfileLines(snapshot);
  return {
    ...mockRecommendations,
    report: mock.report,
    holisticStrategy: mock.holisticStrategy,
    saveStatus: mockRecommendations.recommendations.length ? 'SAVED' : 'NOT_SAVED',
    profileLines: profileLines.length ? profileLines : ['컴퓨터공학 · 통계학 희망', '학생부교과 선호'],
  };
}

/** 리포트 문장: \n 을 줄 단위로 나눠요. */
export function sectionLines(section: ReportSection | null): string[] {
  return section ? section.text.split('\n').filter(line => line.trim()) : [];
}
