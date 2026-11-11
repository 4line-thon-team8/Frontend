import type { AdmissionPreference, ConfirmSubject, GradeConfirmDraft } from '../types/gradeConfirm';
import { identifySubject, isAverageSubject } from './subjectCatalog';

const exclusionMessages = new Map([
  ['OUTSIDE_CORE_SUBJECTS_POLICY', '이번 참고 평균의 계산 범위에서 제외됩니다.'],
  ['CURRICULUM_2015_OUT_OF_SCOPE', '2015 개정 교육과정 과목은 이번 참고 평균에서 제외됩니다.'],
  ['COMPLETION_ONLY_NO_RANK', '이수 여부만 기록되고 석차등급이 없어 제외됩니다.'],
  ['SCIENCE_INQUIRY_EXPERIMENT_NO_RANK', '과학탐구실험은 석차등급을 산출하지 않아 제외됩니다.'],
  ['SOCIAL_SCIENCE_CONVERGENCE_NO_RANK', '이 융합선택 과목은 석차등급을 산출하지 않아 제외됩니다.'],
  ['STANDARD_PE_ARTS_NO_RANK', '이 체육·예술 과목은 석차등급을 산출하지 않아 제외됩니다.'],
]);

export interface GradeConfirmRules {
  maxMajors: number;
  allowedMajorIds: readonly string[];
  allowedAdmissions: readonly AdmissionPreference[];
}

export function reviewSubject(subject: ConfirmSubject, curriculum: GradeConfirmDraft['curriculum']) {
  if (curriculum !== '2022') {
    return { status: 'review', message: '2022 개정 교육과정 성적표인지 확인해 주세요.' } as const;
  }
  const match = identifySubject(subject.name, curriculum);
  if (match.status !== 'identified') {
    const message = match.status === 'ambiguous'
      ? '일치하는 과목이 여러 개입니다. 성적표의 공식 과목명을 확인해 주세요.'
      : '2022 과목 사전에서 찾을 수 없습니다. 성적표의 과목명을 확인해 주세요.';
    return { status: 'review', message } as const;
  }
  const { code: subjectCode, name: subjectName, exclusionReason } = match.subject;
  const identified = { subjectCode, subjectName };

  if (!isAverageSubject(match.subject)) {
    const message = exclusionMessages.get(exclusionReason ?? '') ?? '이번 참고 평균의 계산 범위에서 제외됩니다.';
    return { ...identified, status: 'excluded', message } as const;
  }
  const grade = subject.grade.trim();
  if (/^[A-EP]$/u.test(grade)) {
    return { ...identified, status: 'excluded', message: '성취도만 있어 참고 평균에서 제외합니다.' } as const;
  }
  if (!/^[1-5]$/u.test(grade)) {
    return { ...identified, status: 'review', message: '성적표의 숫자 석차등급(1~5)을 확인해 주세요.' } as const;
  }
  return { ...identified, status: 'included', gradeValue: Number(grade) } as const;
}

export function validateSubjects(draft: GradeConfirmDraft): string[] {
  const reviews = draft.subjects.map(subject => reviewSubject(subject, draft.curriculum));
  const errors: string[] = [];
  if (reviews.some(review => review.status === 'review')) {
    errors.push('확인이 필요한 과목을 수정해 주세요.');
  }
  if (!reviews.some(review => review.status === 'included')) {
    errors.push('참고 평균에 반영할 과목이 1개 이상 필요합니다.');
  }
  return errors;
}

export function validateGradeConfirm(draft: GradeConfirmDraft, rules: GradeConfirmRules): string[] {
  const errors = validateSubjects(draft);
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
