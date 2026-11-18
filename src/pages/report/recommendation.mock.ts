import { useSearchParams } from 'react-router';
import type { ApplicationTier } from './reportTier';
import type { SimulationResult } from '../../services/simulationApi';

// UI 목업 전용 데이터. 리포트 API(GET /api/reports/{report_id}) 명세가 정해지면 응답으로 교체합니다.
// 카드 순서·rank·구간은 BE 응답을 그대로 사용합니다.

export type ResultWarning = {
  /** 예: LOW, OTHER_TRACK, FEWER_THAN_SIX_CARDS, NO_CANDIDATES. 화면 분기는 message 가 아니라 code 로 해요. */
  code: string;
  message: string;
  /** null 이면 결과 전체 안내, 숫자면 해당 rank 카드에만 표시 */
  rank: number | null;
};

export type Recommendation = {
  /** 지망 순서 (1부터) */
  rank: number;
  university: string;
  major: string;
  /** 전형 (예: 교과) */
  admission: string;
  /** BE category. 아직 안 오거나 모르는 값이면 null (구간 배지를 숨겨요) */
  tier: ApplicationTier | null;
  /** BE 응답: recommendations[].reason.text */
  reason: { text: string };
  /** 추천 근거. 실제 응답의 evidence 객체(evidence.isNewOrMergedDepartment 등)로 교체 예정 */
  evidence: string;
};

export type RecommendationResult = {
  /** 0~6장. 0장도 정상 응답입니다. */
  recommendations: Recommendation[];
  warnings: ResultWarning[];
};

const MOCK_FULL: RecommendationResult = {
  recommendations: [
    { rank: 1, university: '명지대', major: '컴퓨터공학', admission: '교과', tier: 'SAFE', reason: { text: '내신 환산이 모집 평균보다 여유 있어요.' }, evidence: '환산 점수 구간' },
    { rank: 2, university: '한성대', major: '통계학', admission: '교과', tier: 'MATCH', reason: { text: '경쟁률과 최근 입결이 비슷한 수준이에요.' }, evidence: '입결 평균' },
    { rank: 3, university: '고려대', major: '컴퓨터공학', admission: '교과', tier: 'MATCH', reason: { text: '활동 연결이 좋아 적정으로 봤어요.' }, evidence: '전형 요건' },
    { rank: 4, university: '서울대', major: '컴퓨터공학', admission: '교과', tier: 'REACH', reason: { text: '상향 카드이며 수학이 변수예요.' }, evidence: '입결 상단' },
    { rank: 5, university: '연세대', major: '컴퓨터공학', admission: '교과', tier: 'SAFE', reason: { text: '여유 있는 안전 카드예요.' }, evidence: '환산 점수' },
    { rank: 6, university: '성균관대', major: '컴퓨터공학', admission: '교과', tier: 'SAFE', reason: { text: '최종 안전 카드예요.' }, evidence: '환산 점수' },
  ],
  warnings: [],
};

const MOCK_PARTIAL: RecommendationResult = {
  recommendations: [
    { rank: 1, university: '명지대', major: '컴퓨터공학', admission: '교과', tier: 'OVER', reason: { text: '내신이 모집 평균보다 많이 여유 있어요.' }, evidence: '환산 점수 구간' },
    { rank: 2, university: '한성대', major: '통계학', admission: '교과', tier: 'MATCH', reason: { text: '경쟁률과 최근 입결이 비슷한 수준이에요.' }, evidence: '입결 평균' },
    { rank: 3, university: '고려대', major: '컴퓨터공학', admission: '교과', tier: 'FAR', reason: { text: '최근 입결보다 성적 차이가 커요.' }, evidence: '입결 상단' },
    { rank: 4, university: '국민대', major: '데이터사이언스', admission: '학종', tier: 'UNRATED', reason: { text: '최근 입결 자료가 부족해 판단이 어려워요.' }, evidence: '자료 없음' },
  ],
  warnings: [
    { code: 'FEWER_THAN_SIX_CARDS', message: '현재 조건에서 추천 가능한 후보는 4장이에요.', rank: null },
    { code: 'SIMILAR_MAJOR_EXPANDED', message: '희망 학과와 비슷한 학과까지 넓혀서 찾았어요.', rank: null },
    { code: 'REACH_NOT_INCLUDED', message: '상향 지원 카드는 포함하지 않았어요.', rank: null },
    { code: 'SIMILAR_MAJOR_EXPANDED', message: '희망 학과와 비슷한 학과까지 넓혀서 찾았어요.', rank: null },
    { code: 'LOW', message: '참고할 수 있는 자료가 적어요.', rank: 2 },
    { code: 'UNRATED', message: '최근 입결 자료가 부족해 판단이 어려워요.', rank: 4 },
    { code: 'OTHER_TRACK', message: '다른 계열 학과예요.', rank: 4 },
  ],
};

const MOCK_EMPTY: RecommendationResult = {
  recommendations: [],
  warnings: [{ code: 'NO_CANDIDATES', message: '현재 조건에서 추천 가능한 후보가 없어요.', rank: null }],
};

/**
 * 목업 결과. 주소 뒤에 ?mock=partial(4장) 또는 ?mock=empty(0장)를 붙이면 다른 상황을 확인할 수 있어요.
 * TODO: reportApi 연동 후 실제 응답으로 교체합니다.
 */
export function useMockRecommendationResult(): RecommendationResult {
  const [params] = useSearchParams();
  const mock = params.get('mock');
  if (mock === 'partial') return MOCK_PARTIAL;
  if (mock === 'empty') return MOCK_EMPTY;
  return MOCK_FULL;
}

export const MOCK_RECOMMENDATIONS = MOCK_FULL.recommendations;

/** BE 주소가 없을 때(시연 모드) 분석 응답 대신 쓰는 목업 */
export function createMockSimulationResult(): SimulationResult {
  return {
    conversion: { overallGrade: 2.5, isAssumed: false, assumptionReasons: [] },
    holistic: { status: 'APPLIED', skipReason: null },
    holisticStrategy: {
      activitySummary: '교내 설문조사에서 역할을 나누고,\n응답 데이터를 분석해 개선안을 제안했어요.',
      strengths: [
        { indicatorId: 'A3', label: '탐구력', level: 5, description: '궁금한 것을 스스로 파고드는 탐구 활동이 보여요.' },
        { indicatorId: 'C1', label: '협업과 소통능력', level: 4, description: '역할을 나누고 결과를 함께 공유했어요.' },
      ],
      majorAdvices: [
        { department: '컴퓨터공학', advice: '직접 만들어 보거나 문제를 코드로 풀어 본 경험을 과정과 결과가 보이게 남겨 보세요.' },
        { department: '통계학', advice: '설문 설계와 결과 해석 경험을 자료 분석 과정으로 설명해 보세요.' },
      ],
      detail: {
        overview: '페니실린 관련 활동이 교과 세특과 동아리에서 이어져 나타나요. 이를 바탕으로 생명·화학 계열과 연결해 볼 수 있어요.',
        strengthEvidence: [
          '페니실린 관련 탐구가 2·3학년 세특에 걸쳐 이어져, 한 주제에 꾸준히 관심을 가진 것으로 보여요.',
          'Python으로 실험 데이터를 정리한 활동이 확인돼, 데이터를 다루는 역량도 함께 보여요.',
          '동아리에서 실험 결과를 발표한 경험이 있어 전달력도 드러나요.',
        ],
        improvements: [
          '탐구의 결과나 결론이 구체적으로 드러난 구절이 상대적으로 적게 확인돼요.',
          '활동에서 맡은 역할과 배우고 느낀 점이 드러나면 설명이 더 풍부해질 수 있어요.',
        ],
        nextSteps: [
          '페니실린 탐구를 과정, 결과, 배우고 느낀 점 순서로 정리해 두면 면접 준비에 도움이 돼요.',
          '소신 지원 카드는 다른 카드와 균형을 고려해 지원 여부를 판단해 보세요.',
          '지원하려는 대학의 모집요강에서 평가요소 반영 비율을 확인해 보세요.',
        ],
      },
    },
    recommendations: MOCK_FULL.recommendations.map(item => ({
      rank: item.rank,
      university: item.university,
      department: item.major,
      admissionType: item.admission,
      category: item.tier,
      overallCategory: null,
      documentFit: null,
      reason: { text: item.reason.text, generationMethod: 'template' },
      evidence: null,
    })),
    report: {
      greetingSummary: { text: '컴퓨터공학 · 통계학 희망, 학생부교과 선호 방향을 바탕으로 안내드릴게요.', generationMethod: 'template' },
      overallAssessment: { text: '수학이 상대적으로 낮아 안정·적정 위주로 구성했어요.\n+ 소신 1장 포함', generationMethod: 'template' },
      applicationStrategy: { text: '추천 전형의 공개 모집요강을 함께 확인해 주세요.', generationMethod: 'template' },
      closing: { text: '지원 전 최신 모집요강과 지원 자격을 확인해 주세요.', generationMethod: 'template' },
    },
    warnings: [],
    saveStatus: 'SAVED',
    reportId: null,
  };
}
