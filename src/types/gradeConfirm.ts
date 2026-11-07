// S-03 프론트엔드 UI 전용 모델입니다. 백엔드 요청/응답 계약이 아닙니다.
export interface ConfirmSubject {
  id: string;
  name: string;
  grade: string;
  needsReview: boolean;
}

export type AdmissionPreference = 'school-record' | 'comprehensive' | 'exam' | 'any';

export interface GradeConfirmDraft {
  subjects: ConfirmSubject[];
  majorIds: string[];
  admissions: AdmissionPreference[];
  includeReach: boolean;
  expandSimilarMajors: boolean;
}
