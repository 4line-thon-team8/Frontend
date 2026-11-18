import { useCallback, useEffect, useState } from 'react';
import { isNetworkError, isSessionExpiredError, NETWORK_ERROR_MESSAGE } from '../../services/authApi';
import {
  formatReportDate, formatReportTime, getReport, getReports, NoTokenError,
  type SavedReportDetail,
} from '../../services/reportApi';
import { APPLICATION_TIERS, TIER_LABELS, toApplicationTier, type ApplicationTier } from '../report/reportTier';

export type SavedReportCardData = {
  id: string;
  createdAt: string;
  title: string;
  /** 예: 추천 원서 6장 · 안정 3 / 적정 2 / 소신 1. 상세를 아직 못 읽었으면 없어요. */
  summary?: string;
};

/** 예: 추천 원서 4장 · 적정 2 / 도전 부담이 큰 후보 1 / 판단 자료 부족 1 (0장 구간은 빼요) */
function formatReportCounts(total: number, counts: Partial<Record<ApplicationTier, number>>) {
  const tiers = APPLICATION_TIERS.filter(tier => (counts[tier] ?? 0) > 0);
  const breakdown = tiers.map(tier => `${TIER_LABELS[tier]} ${counts[tier]}`).join(' / ');
  return breakdown ? `추천 원서 ${total}장 · ${breakdown}` : `추천 원서 ${total}장`;
}

/** 목록 API 는 reportId·createdAt 만 줘요. 학과·장수를 받기 전까지는 생성 시각을 제목으로 보여줘요. */
function toReportCard(summary: { reportId: string; createdAt: string }): SavedReportCardData {
  return {
    id: summary.reportId,
    createdAt: formatReportDate(summary.createdAt),
    title: `${formatReportTime(summary.createdAt)} 생성`,
  };
}

/** 저장본 상세로 Figma 처럼 "1지망 학과 외 N개" + 구간별 장수를 만들어요. */
function describeReport(detail: SavedReportDetail): Pick<SavedReportCardData, 'title' | 'summary'> | null {
  const [first, ...rest] = detail.recommendations;
  if (!first) return null;
  const counts: Partial<Record<ApplicationTier, number>> = {};
  for (const item of detail.recommendations) {
    const tier = toApplicationTier(item.category);
    if (tier) counts[tier] = (counts[tier] ?? 0) + 1;
  }
  return {
    title: rest.length > 0 ? `${first.department} 외 ${rest.length}개` : first.department,
    summary: formatReportCounts(detail.recommendations.length, counts),
  };
}

export const isAuthError = (error: unknown) => error instanceof NoTokenError || isSessionExpiredError(error);

/**
 * 저장된 리포트 카드 목록 (마이페이지 · 메인 '나의 리포트' 공용). 삭제는 리포트 상세 화면에서만 해요.
 * 토큰 없음·만료(401)는 onAuthError 로 넘겨요. 화면마다 처리가 달라서예요.
 */
export function useSavedReports(onAuthError: () => void) {
  const [reports, setReports] = useState<SavedReportCardData[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [listError, setListError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false; // 화면을 떠난 뒤 도착한 응답은 무시해요.
    getReports()
      .then(summaries => {
        if (ignore) return;
        setReports(summaries.map(toReportCard));
        setListState('ready');
        // 목록에 학과·장수가 없어서 저장본을 하나씩 읽어 채워요. 실패한 카드는 생성 시각 제목을 그대로 둬요.
        summaries.forEach(({ reportId }) => {
          getReport(reportId)
            .then(detail => {
              if (ignore) return;
              const described = describeReport(detail);
              if (!described) return;
              setReports(current => current.map(report => (report.id === reportId ? { ...report, ...described } : report)));
            })
            .catch(() => { /* 제목만 못 채운 것이라 목록은 그대로 보여줘요. */ });
        });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        if (isAuthError(error)) {
          onAuthError();
          return;
        }
        setListError(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : '저장된 리포트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
        setListState('error');
      });
    return () => { ignore = true; };
  }, [onAuthError, reloadKey]);

  const reload = useCallback(() => {
    setListState('loading');
    setReloadKey(key => key + 1);
  }, []);

  return { reports, listState, listError, reload };
}
