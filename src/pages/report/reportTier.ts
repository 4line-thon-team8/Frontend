// 추천 구간: BE 응답 코드를 그대로 사용하고, FE에서 gradeGap 등으로 구간을 다시 계산하지 않습니다.
export const APPLICATION_TIERS = ['SAFE', 'MATCH', 'REACH', 'FAR', 'OVER', 'UNRATED'] as const;
export type ApplicationTier = (typeof APPLICATION_TIERS)[number];

export const TIER_LABELS: Record<ApplicationTier, string> = {
  SAFE: '안정',
  MATCH: '적정',
  REACH: '소신',
  FAR: '도전 부담이 큰 후보',
  OVER: '성적 여유가 있는 후보',
  UNRATED: '판단 자료 부족',
};

export const tierClassName = (tier: ApplicationTier) => `is-${tier.toLowerCase()}`;

export type TierCount = { tier: ApplicationTier; label: string; count: number };

/** 구간별 카드 수 (0장인 구간은 빼고, 구간 순서대로) */
export function countByTier(items: readonly { tier: ApplicationTier }[]): TierCount[] {
  return APPLICATION_TIERS
    .map(tier => ({ tier, label: TIER_LABELS[tier], count: items.filter(item => item.tier === tier).length }))
    .filter(item => item.count > 0);
}
