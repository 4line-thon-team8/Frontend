import { useSearchParams } from 'react-router';
import type { ApplicationTier } from './reportTier';

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
  tier: ApplicationTier;
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
