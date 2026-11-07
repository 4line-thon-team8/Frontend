import type { AdmissionPreference, GradeConfirmDraft } from '../../types/gradeConfirm';

// UI 목업 전용 목록/규칙. 실제 학과 사전·과목·등급 체계는 추후 명세로 교체합니다.
export const MOCK_GRADE_LIMITS = { min: 1, max: 9 } as const;
export const MOCK_MAJOR_LIMIT = 3;
export const MOCK_MAJORS = [
  { id: 'computer', name: '컴퓨터공학' },
  { id: 'statistics', name: '통계학' },
  { id: 'business', name: '경영학' },
  { id: 'economics', name: '경제학' },
  { id: 'nursing', name: '간호학' },
  { id: 'electronics', name: '전자공학' },
  { id: 'mechanical', name: '기계공학' },
  { id: 'psychology', name: '심리학' },
];
export const ADMISSION_OPTIONS: { id: AdmissionPreference; name: string }[] = [
  { id: 'school-record', name: '학생부교과' },
  { id: 'comprehensive', name: '학생부종합' },
  { id: 'exam', name: '정시' },
  { id: 'any', name: '상관없음' },
];

export function createMockGradeConfirmDraft(): GradeConfirmDraft {
  return {
    subjects: [
      { id: 'korean', name: '국어', grade: '2', needsReview: false },
      { id: 'math', name: '수학', grade: '3', needsReview: false },
      { id: 'english', name: '영어', grade: '2', needsReview: false },
      { id: 'inquiry-1', name: '탐구 1', grade: '1', needsReview: false },
      { id: 'inquiry-2', name: '탐구 2', grade: '2', needsReview: false },
      { id: 'history', name: '한국사', grade: '1', needsReview: false },
    ],
    majorIds: ['computer', 'statistics'],
    admissions: ['school-record'],
    includeReach: true,
    expandSimilarMajors: false,
  };
}
