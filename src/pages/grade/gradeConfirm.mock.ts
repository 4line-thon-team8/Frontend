import type { AdmissionPreference, GradeConfirmDraft } from '../../types/gradeConfirm';

export const MAJOR_LIMIT = 3;
export const ADMISSION_OPTIONS: { id: AdmissionPreference; name: string }[] = [
  { id: 'school-record', name: '학생부교과' },
  { id: 'comprehensive', name: '학생부종합' },
  { id: 'any', name: '상관없음' },
];

export function createInitialGradeConfirmDraft(): GradeConfirmDraft {
  return {
    curriculum: '2022',
    subjects: [],
    majorIds: [],
    admissions: ['school-record'],
    includeReach: true,
    expandSimilarMajors: false,
  };
}
