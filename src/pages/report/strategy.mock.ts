// UI 목업 전용 데이터. 리포트 API(GET /api/reports/{report_id}) 명세가 정해지면 응답으로 교체합니다.

export type ActivityScore = { id: string; name: string; score: number; description: string };
export type MajorAdvice = { major: string; advice: string };

export type StrategyReport = {
  /** 입력한 활동 요약 (줄 단위) */
  activitySummaryLines: string[];
  /** 역량 점수 (5점 만점) */
  scores: ActivityScore[];
  /** 희망 학과별 서술 조언 (\n 은 줄바꿈) */
  advices: MajorAdvice[];
};

export const SCORE_MAX = 5;

export const MOCK_STRATEGY_REPORT: StrategyReport = {
  activitySummaryLines: ['교내 설문조사에서 역할을 나누고,', '응답 데이터를 분석해 개선안을 제안했어요.'],
  scores: [
    { id: 'inquiry', name: '탐구', score: 4, description: '질문을 세우고 해결 방법을 탐색했어요.' },
    { id: 'collaboration', name: '협업', score: 3, description: '조사 · 분석 역할을 나누고 결과를 공유했어요.' },
    { id: 'data', name: '데이터 분석', score: 5, description: 'Python으로 자료를 정리하고 결과를 해석했어요.' },
  ],
  advices: [
    { major: '컴퓨터 공학', advice: 'Python 활용 경험을 문제 해결 과정과 연결해 정리해 보세요.' },
    { major: '통계학', advice: '설문 설계와 결과 해석 경험을 자료 분석 과정으로\n설명해 보세요.' },
  ],
};
