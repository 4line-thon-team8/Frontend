import { useId, useState } from 'react';
import NoReport from '../../components/report/NoReport';
import BottomNavigation from '../../components/common/BottomNavigation';
import RecommendationEmpty from '../../components/report/RecommendationEmpty';
import ReportPagination from '../../components/report/ReportPagination';
import ResultNotices from '../../components/report/ResultNotices';
import { getCardWarnings, isNoCandidates } from '../../components/report/resultWarnings';
import clipboard from '../../assets/icons/clipboard.svg';
import { useReportView } from './analysisResult';
import type { Recommendation, ResultWarning } from './recommendation.mock';
import { TIER_LABELS, tierClassName } from './reportTier';
import './ReportPage.css';
import './RecommendationPage.css';

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true" style={up ? { transform: 'rotate(180deg)' } : undefined}>
      <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 카드마다 붙어 오는 '(지원 전) 최신 모집요강과 지원 자격을 확인해 주세요.' 문장은 빼요.
 * 같은 안내를 화면 맨 위에 한 번만 보여줘요 (Figma).
 */
const ADMISSION_CHECK_SENTENCE = /\s*(?:지원\s*전\s*)?최신\s*모집\s*요강과\s*지원\s*자격을\s*확인해\s*주세요\.?/g;

function stripAdmissionCheck(text: string) {
  return text.replace(ADMISSION_CHECK_SENTENCE, '').trim();
}

/**
 * 추천 카드 (Figma '수정된 리포트'): 지망·학교·배지 → 근거 칩 → '펼쳐보기'.
 * 추천 이유는 글이 길어서 접어 두고, 펼치면 보여줘요. 카드별 주의 안내는 접어도 항상 보여요.
 */
function RecommendationCard({ item, warnings }: { item: Recommendation; warnings: ResultWarning[] }) {
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  const reasonText = stripAdmissionCheck(item.reason.text);
  const hasReason = reasonText !== '';

  return (
    <li className={`report-fold-card recommendation-card ${tierClassName(item.tier)}`}>
      <h2>
        <span className="recommendation-card__rank">{item.rank}지망</span>
        {item.university} {item.major}{item.admission && ` · ${item.admission}`}
      </h2>
      {item.tier && <span className="recommendation-card__tier">{TIER_LABELS[item.tier]}</span>}
      {item.evidence && <p className="recommendation-card__evidence">{item.evidence}</p>}
      {warnings.map(warning => (
        <p key={`${warning.code}-${warning.message}`} className="recommendation-card__warning">{warning.message}</p>
      ))}
      {hasReason && open && <p id={reasonId} className="recommendation-card__reason">{reasonText}</p>}
      {hasReason && (
        <button
          type="button"
          className="recommendation-card__toggle"
          aria-expanded={open}
          aria-controls={open ? reasonId : undefined}
          onClick={() => setOpen(current => !current)}
        >
          {open ? '닫기' : '펼쳐보기'}
          <ChevronIcon up={open} />
        </button>
      )}
    </li>
  );
}

export default function RecommendationPage() {
  const view = useReportView();
  // 아직 분석한 리포트가 없으면(하단 리포트 탭으로 바로 온 경우 등) 빈 화면을 보여줘요.
  if (!view) return <NoReport />;
  const { recommendations, warnings } = view;

  return (
    <div className="report-page">
      <header className="report-header">
        <h1>
          <img src={clipboard} alt="" width="15" height="17" />
          추천 원서 {recommendations.length}장
        </h1>
        <p>*최신 모집요강과 지원 자격을 확인해 주세요.</p>
      </header>

      {isNoCandidates(view) ? <RecommendationEmpty /> : (
        <>
          <ResultNotices count={recommendations.length} warnings={warnings} />

          {/* 카드 순서·rank·구간은 BE 응답 그대로 */}
          <ol className="recommendation-list">
            {recommendations.map(item => (
              <RecommendationCard key={item.rank} item={item} warnings={getCardWarnings(warnings, item)} />
            ))}
          </ol>

          <div className="report-pagination-slot">
            <ReportPagination current={3} />
          </div>
        </>
      )}

      <BottomNavigation />
    </div>
  );
}
