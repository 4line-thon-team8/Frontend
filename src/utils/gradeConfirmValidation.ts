import type { AdmissionPreference, GradeConfirmDraft } from '../types/gradeConfirm';

export interface GradeConfirmRules {
  minGrade: number;
  maxGrade: number;
  maxMajors: number;
  allowedMajorIds: readonly string[];
  allowedAdmissions: readonly AdmissionPreference[];
}

// 범위와 선택지는 외부에서 주입합니다. 현재 사용 값은 UI 목업 규칙입니다.
export function isValidSubject(name: string, grade: string, rules: GradeConfirmRules): boolean {
  return name.trim().length > 0 && /^\d+$/.test(grade) && Number(grade) >= rules.minGrade && Number(grade) <= rules.maxGrade;
}

export function validateGradeConfirm(draft: GradeConfirmDraft, rules: GradeConfirmRules): string[] {
  const errors: string[] = [];
  if (!draft.subjects.length || draft.subjects.some(subject => !isValidSubject(subject.name, subject.grade, rules))) {
    errors.push(`과목명과 ${rules.minGrade}~${rules.maxGrade} 사이의 정수 등급을 입력해주세요.`);
  }
  if (draft.majorIds.length < 1 || draft.majorIds.length > rules.maxMajors ||
    new Set(draft.majorIds).size !== draft.majorIds.length || draft.majorIds.some(id => !rules.allowedMajorIds.includes(id))) {
    errors.push(`희망 학과를 1~${rules.maxMajors}개 선택해주세요.`);
  }
  if (!draft.admissions.length || new Set(draft.admissions).size !== draft.admissions.length ||
    draft.admissions.some(id => !rules.allowedAdmissions.includes(id)) ||
    (draft.admissions.includes('any') && draft.admissions.length > 1)) {
    errors.push('선호하는 전형을 1개 이상 선택해주세요.');
  }
  return errors;
}

// UI 목업 동작: 상관없음과 구체적인 전형은 서로 배타적입니다. 서비스 규칙 확정 시 재검토합니다.
export function toggleAdmission(current: AdmissionPreference[], selected: AdmissionPreference): AdmissionPreference[] {
  if (current.includes(selected)) return current.filter(id => id !== selected);
  if (selected === 'any') return ['any'];
  return [...current.filter(id => id !== 'any'), selected];
}
