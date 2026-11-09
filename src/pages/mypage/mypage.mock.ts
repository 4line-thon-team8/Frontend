import type { ApplicationTier } from '../report/strategy.mock';

// UI 목업 전용 데이터. 리포트 API(GET /api/reports, GET·DELETE /api/reports/{report_id}) 명세가 정해지면 응답으로 교체합니다.

export type SavedReport = {
  id: string;
  /** 생성일 (YYYY.MM.DD) */
  createdAt: string;
  /** 대표 학과 + 나머지 개수 (예: 컴퓨터공학 외 5개) */
  title: string;
  counts: Record<ApplicationTier, number>;
};

export const MOCK_SAVED_REPORTS: SavedReport[] = [
  { id: '20261028', createdAt: '2026.10.28', title: '컴퓨터공학 외 5개', counts: { safe: 3, match: 2, reach: 1 } },
  { id: '20261020', createdAt: '2026.10.20', title: '통계학 외 5개', counts: { safe: 3, match: 2, reach: 1 } },
];

/** 시스템 규칙: 굵은 제목 - 설명 */
export const SYSTEM_RULES: { title: string; description: string }[] = [
  { title: '원본 폐기', description: '성적표 이미지·PDF는 서버로 전송하지 않고, 처리 후 폐기해요.' },
  { title: '수치와 설명 분리', description: '수치는 엔진이 계산, LLM은 설명만. 실패 시 템플릿' },
  { title: '원서 6장 고정', description: '매번 정확히 6장을 추천해요. 논술은 고려하지 않아요.' },
  { title: '추정·면책', description: '모든 결과는 추정이며 합격을 보장하지 않는다고 표시해요.' },
  { title: '표현 규칙', description: '단정적·법적 확정 표현을 쓰지 않아요.' },
  { title: '저장 규칙', description: '저장: 6장·이유·생성 시각. 비저장: 성적·환산·방향·요약·활동·원본' },
  // Figma 원문 그대로입니다. 제목이 2번째 규칙과 같아 기획 확인이 필요합니다.
  { title: '수치와 설명 분리', description: '같은 요청은 1회만 저장, 재분석은 새 리포트. 탈퇴 시 전체 삭제' },
];
