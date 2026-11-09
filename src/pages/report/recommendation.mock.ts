import type { ApplicationTier } from './strategy.mock';

// UI 목업 전용 데이터. 리포트 API(GET /api/reports/{report_id}) 명세가 정해지면 응답으로 교체합니다.

export type Recommendation = {
  /** 지망 순서 (1부터) */
  rank: number;
  university: string;
  major: string;
  /** 전형 (예: 교과) */
  admission: string;
  tier: ApplicationTier;
  reason: string;
  /** 추천 근거 */
  evidence: string;
};

export const TIER_LABELS: Record<ApplicationTier, string> = { safe: '안정', match: '적정', reach: '소신' };

export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  { rank: 1, university: '명지대', major: '컴퓨터공학', admission: '교과', tier: 'safe', reason: '내신 환산이 모집 평균보다 여유 있어요.', evidence: '환산 점수 구간' },
  { rank: 2, university: '한성대', major: '통계학', admission: '교과', tier: 'match', reason: '경쟁률과 최근 입결이 비슷한 수준이에요.', evidence: '입결 평균' },
  { rank: 3, university: '고려대', major: '컴퓨터공학', admission: '교과', tier: 'match', reason: '활동 연결이 좋아 적정으로 봤어요.', evidence: '전형 요건' },
  { rank: 4, university: '서울대', major: '컴퓨터공학', admission: '교과', tier: 'reach', reason: '상향 카드이며 수학이 변수예요.', evidence: '입결 상단' },
  { rank: 5, university: '연세대', major: '컴퓨터공학', admission: '교과', tier: 'safe', reason: '여유 있는 안전 카드예요.', evidence: '환산 점수' },
  { rank: 6, university: '성균관대', major: '컴퓨터공학', admission: '교과', tier: 'safe', reason: '최종 안전 카드예요.', evidence: '환산 점수' },
];
