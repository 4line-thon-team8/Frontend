import BottomNavigation from '../../components/common/BottomNavigation';
import ReportPagination from '../../components/report/ReportPagination';
import clipboard from '../../assets/icons/clipboard.svg';
import RecommendationEmpty from '../../components/report/RecommendationEmpty';
import { isNoCandidates } from '../../components/report/resultWarnings';
import { Navigate } from 'react-router';
import { useState } from 'react';
import StrengthDetailDialog, { type StrengthDetailSection } from '../../components/report/StrengthDetailDialog';
import type { HolisticStrategy } from '../../services/simulationApi';
import { sectionLines, useReportView } from './analysisResult';
import { countByTier, tierClassName } from './reportTier';
import './ReportPage.css';
import './StrategyPage.css';

/** 강점 막대 칸 수. Figma 수정안: 5칸 → 3칸 */
const SCORE_MAX = 3;
const BE_LEVEL_MAX = 5;

/**
 * BE level(1~5)을 3칸 기준으로 바꿔요. 반올림이라 5 → 3, 4·3 → 2, 2·1 → 1.
 * (BE 는 강점으로 4·5만 보내서 실제로는 2 또는 3칸이에요.)
 */
const toScore = (level: number) => Math.min(SCORE_MAX, Math.max(1, Math.round((level * SCORE_MAX) / BE_LEVEL_MAX)));

/** 활동 요약은 한 문장만 보여줘요 (Figma: 리포트 요약 문장 / 한 문장으로 제한). */
function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const match = flat.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0] : flat;
}

/**
 * '자세히 보기' 창 내용. 시안의 전용 문장(강점 근거·보완할 점 등)은 아직 BE 응답에 없어서,
 * 지금 받는 값으로 채우고 없는 항목은 숨겨요. TODO: BE 상세 필드가 생기면 교체
 */
function toDetailSections({ activitySummary, strengths, majorAdvices }: HolisticStrategy): StrengthDetailSection[] {
  return [
    { title: '한눈에 보기', lines: activitySummary ? [activitySummary.replace(/\s+/g, ' ').trim()] : [] },
    { title: '강점의 근거', lines: strengths.filter(item => item.description).map(item => `${item.label}: ${item.description}`) },
    { title: '다음 준비 방향', lines: majorAdvices.map(item => `${item.department}: ${item.advice}`) },
  ];
}

export default function StrategyPage() {
  const view = useReportView();
  const [detailOpen, setDetailOpen] = useState(false);
  if (!view) return <Navigate to="/grade/input" replace />;
  // BE holistic.activitySummary·strengths·majorAdvices. 비어 있는 영역은 숨겨요 (BE 1단계에는 강점만 와요).
  const { activitySummary, strengths, majorAdvices } = view.holisticStrategy;
  const detailSections = toDetailSections(view.holisticStrategy);
  const summarySentence = activitySummary ? firstSentence(activitySummary) : '';
  const hasActivitySection = summarySentence !== '' || strengths.length > 0 || majorAdvices.length > 0;
  const strategyLines = sectionLines(view.report.applicationStrategy);
  const { recommendations } = view;
  // 추천 카드의 구간(BE 값)별 장수. 0장인 구간은 표시하지 않아요.
  const applications = countByTier(recommendations);

  if (isNoCandidates(view)) {
    return (
      <div className="report-page">
        <header className="report-header">
          <h1>
            <img src={clipboard} alt="" width="15" height="17" />
            활동·지원 전략
          </h1>
        </header>
        <RecommendationEmpty />
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="report-page report-page--fixed-pagination">
      <header className="report-header">
        <h1>
          <img src={clipboard} alt="" width="15" height="17" />
          활동·지원 전략
        </h1>
        <p>*서술 원문 전체는 보내지 않아요.<br />이름·학교명을 가린 짧은 근거 구절만 AI 설명에 쓰이고, 저장하지 않도록 만들었어요.</p>
      </header>

      {summarySentence && <>
        <section className="report-fold-card strategy-activity" aria-label="활동 요약">
          <p>{summarySentence}</p>
        </section>

        <hr className="report-divider" />
      </>}

      {strengths.length > 0 && (
        <section className="strategy-strengths" aria-labelledby="strategy-strengths-title">
          <h2 id="strategy-strengths-title" className="report-section-label">활동에서의 강점</h2>
          <div className="report-fold-card report-fold-card--primary strategy-scores">
            <button type="button" className="strategy-scores__more" onClick={() => setDetailOpen(true)}>
              자세히 보기 <span aria-hidden="true">&gt;</span>
            </button>
            <ul>
              {strengths.map(item => {
                const score = toScore(item.level);
                return (
                  <li key={item.indicatorId} className="strategy-score">
                    <h3>{item.label}</h3>
                    <div className="strategy-score__detail">
                      <div className="strategy-score__bar" role="img" aria-label={`${SCORE_MAX}점 중 ${score}점`}>
                        {Array.from({ length: SCORE_MAX }, (_, index) => (
                          <span key={index} className={index < score ? 'is-filled' : undefined} />
                        ))}
                      </div>
                      {/* 설명은 한 줄. 넘치면 말줄임(…)으로 자르고, 전체 문장은 title 로 볼 수 있어요. */}
                      {item.description && <p title={item.description}>{item.description}</p>}
                    </div>
                    <span className="strategy-score__value" aria-hidden="true"><strong>{score}</strong> / {SCORE_MAX}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {majorAdvices.length > 0 && (
        <section className="report-fold-card strategy-advice" aria-label="학과별 활동 조언">
          {majorAdvices.map(item => (
            <div key={item.department} className="strategy-advice__item">
              <h2>{item.department}</h2>
              <p>{item.advice}</p>
            </div>
          ))}
        </section>
      )}

      {hasActivitySection && <hr className="report-divider" />}

      <section className="strategy-applications" aria-labelledby="strategy-applications-title">
        <h2 id="strategy-applications-title" className="report-section-label">나의 지원 전략</h2>
        <ul>
          {applications.map(item => (
            <li key={item.tier} className={`strategy-application ${tierClassName(item.tier)}`}>
              <span className="strategy-application__count"><strong>{item.count}</strong> 장</span>
              <span className="strategy-application__label">{item.label}</span>
            </li>
          ))}
        </ul>
        {/* BE report.applicationStrategy (근거 기반 지원 방향 안내) */}
        {strategyLines.length > 0 && (
          <div className="report-fold-card strategy-advice">
            {strategyLines.map((line, index) => <p key={index}>{line}</p>)}
          </div>
        )}
      </section>

      <StrengthDetailDialog open={detailOpen} sections={detailSections} onClose={() => setDetailOpen(false)} />

      <div className="report-pagination-slot">
        <ReportPagination current={2} />
      </div>

      <BottomNavigation />
    </div>
  );
}
