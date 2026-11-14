import type { Recommendation, ResultWarning } from '../../pages/report/recommendation.mock';

export const MAX_RECOMMENDATIONS = 6;

/**
 * 안내 목록에 그대로 띄우지 않는 warning 코드
 * - OTHER_TRACK: 별도 안내·배지 없음
 * - FEWER_THAN_SIX_CARDS / NO_CANDIDATES: 장수 안내·0장 화면으로 따로 보여줘요 (중복 방지)
 */
const HIDDEN_WARNING_CODES = new Set(['OTHER_TRACK', 'FEWER_THAN_SIX_CARDS', 'NO_CANDIDATES']);

/** 추천 0장(정상 응답): 빈 배열이거나 NO_CANDIDATES 경고 */
export function isNoCandidates(result: { recommendations: unknown[]; warnings: ResultWarning[] }): boolean {
  return result.recommendations.length === 0 || result.warnings.some(warning => warning.code === 'NO_CANDIDATES');
}

function uniqueVisible(warnings: ResultWarning[]): ResultWarning[] {
  const seen = new Set<string>();
  return warnings.filter(warning => {
    if (HIDDEN_WARNING_CODES.has(warning.code)) return false;
    const key = `${warning.code}\u0000${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 결과 전체 안내 (유사 학과 확장·소신 미포함 등): 결과 상단에 각각 한 번만 */
export function getResultWarnings(warnings: ResultWarning[]): ResultWarning[] {
  return uniqueVisible(warnings.filter(warning => warning.rank === null));
}

/** 해당 rank 카드에만 표시할 안내 (LOW 등). 추천 이유와 같은 문구는 한 번만 보이도록 뺍니다. */
export function getCardWarnings(warnings: ResultWarning[], card: Recommendation): ResultWarning[] {
  return uniqueVisible(warnings.filter(warning => warning.rank === card.rank && warning.message.trim() !== card.reason.text.trim()));
}
