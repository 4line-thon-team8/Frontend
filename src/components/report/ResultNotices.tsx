import type { ResultWarning } from '../../pages/report/recommendation.mock';
import { MAX_RECOMMENDATIONS, getResultWarnings } from './resultWarnings';
import './ResultNotices.css';

type ResultNoticesProps = {
  count: number;
  warnings: ResultWarning[];
};

/** 추천 결과 상단 안내: 1~5장일 때 장수 안내 + 결과 전체 warnings (각각 한 번만) */
export default function ResultNotices({ count, warnings }: ResultNoticesProps) {
  const notices = getResultWarnings(warnings);
  const showCount = count > 0 && count < MAX_RECOMMENDATIONS;
  if (!showCount && notices.length === 0) return null;

  return (
    <section className="result-notices" aria-label="추천 결과 안내">
      {showCount && <p className="result-notices__count">현재 조건에서 추천 가능한 후보는 {count}장이에요.</p>}
      {notices.length > 0 && (
        <ul>
          {notices.map(notice => <li key={`${notice.code}-${notice.message}`}>{notice.message}</li>)}
        </ul>
      )}
    </section>
  );
}
