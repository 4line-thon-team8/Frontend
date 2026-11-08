// UI 목업 전용 데이터. 리포트 API(GET /api/reports/{report_id}) 명세가 정해지면 응답으로 교체합니다.

/** 강조(굵게) 여부가 섞인 한 줄 문장 */
export type RichTextPart = { text: string; bold?: boolean };

export type ReportSummary = {
  /** 요약 카드: 희망 학과 / 선호 전형 */
  profileLines: string[];
  /** 총평: 줄마다 강조 구간이 섞인 문장 */
  overallLines: RichTextPart[][];
};

export const MOCK_REPORT_SUMMARY: ReportSummary = {
  profileLines: ['컴퓨터공학 · 통계학 희망', '학생부교과 선호'],
  overallLines: [
    [
      { text: '수학', bold: true },
      { text: '이 상대적으로 낮아 ' },
      { text: '안정·적정 위주', bold: true },
      { text: '로 구성' },
    ],
    [
      { text: '+ ' },
      { text: '소신 1장', bold: true },
      { text: ' 포함' },
    ],
  ],
};
