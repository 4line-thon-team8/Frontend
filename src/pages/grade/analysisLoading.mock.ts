// S-04 정적 UI 목업입니다. 실제 작업 ID·진행률·API 응답 모델이 아닙니다.
export type AnalysisStepStatus = 'complete' | 'waiting';

export interface AnalysisLoadingStep {
  id: string;
  label: string;
  status: AnalysisStepStatus;
}

// API 연동 시 이 데이터를 실제 작업 상태에 매핑합니다. 타이머로 변경하지 않습니다.
export const MOCK_ANALYSIS_STEPS: readonly AnalysisLoadingStep[] = [
  { id: 'recommendations', label: '추천 원서 조합', status: 'complete' },
  { id: 'report', label: '컨설팅 리포트 작성', status: 'waiting' },
];
