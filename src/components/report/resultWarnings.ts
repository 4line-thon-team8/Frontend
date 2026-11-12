import type { Recommendation, ResultWarning } from '../../pages/report/recommendation.mock';

export const MAX_RECOMMENDATIONS = 6;

/** 화면에 따로 안내하거나 배지를 달지 않는 warning 코드 */
const HIDDEN_WARNING_CODES = new Set(['OTHER_TRACK']);

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
  return uniqueVisible(warnings.filter(warning => warning.rank === card.rank && warning.message.trim() !== card.reason.trim()));
}
