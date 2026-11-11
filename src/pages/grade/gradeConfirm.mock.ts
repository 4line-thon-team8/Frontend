import type { AdmissionPreference, GradeConfirmDraft } from '../../types/gradeConfirm';

// UI 목업 전용 목록/규칙. 희망 학과는 목업 목록입니다.
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
  { id: 'any', name: '상관없음' },
];

export function createMockGradeConfirmDraft(): GradeConfirmDraft {
  return {
    curriculum: '2022',
    subjects: [
      { id: 'korean', name: '공통국어1', grade: '2' },
      { id: 'math', name: '공통수학1', grade: '3' },
      { id: 'english', name: '공통영어1', grade: '2' },
      { id: 'inquiry-1', name: '통합사회1', grade: '1' },
      { id: 'inquiry-2', name: '통합과학1', grade: '2' },
      { id: 'history', name: '한국사1', grade: '1' },
    ],
    majorIds: ['computer', 'statistics'],
    admissions: ['school-record'],
    includeReach: true,
    expandSimilarMajors: false,
  };
}
