import type { AdmissionPreference, GradeConfirmDraft } from '../../types/gradeConfirm';

// UI 목업 전용 목록/규칙. 희망 학과는 목업 목록입니다.
// id 는 BE 학과 사전(GET /api/majors)의 code 예요. 분석 요청 desiredMajorCodes 로 그대로 보내요.
export const MOCK_MAJOR_LIMIT = 3;
export const MOCK_MAJORS = [
  { id: 'COMPUTER_ENG', name: '컴퓨터공학' },
  { id: 'STATISTICS', name: '통계학' },
  { id: 'BUSINESS', name: '경영학' },
  { id: 'ECONOMICS', name: '경제학' },
  { id: 'NURSING', name: '간호학' },
  { id: 'ELECTRONIC_ENG', name: '전자공학' },
  { id: 'MECHANICAL_ENG', name: '기계공학' },
  { id: 'PSYCHOLOGY', name: '심리학' },
];
export const ADMISSION_OPTIONS: { id: AdmissionPreference; name: string }[] = [
  { id: 'school-record', name: '학생부교과' },
  { id: 'comprehensive', name: '학생부종합' },
  { id: 'any', name: '상관없음' },
];

export function createInitialGradeConfirmDraft(): GradeConfirmDraft {
  return {
    curriculum: '2022',
    subjects: [],
    majorIds: ['COMPUTER_ENG', 'STATISTICS'],
    admissions: ['school-record'],
    includeReach: true,
    expandSimilarMajors: false,
  };
}
