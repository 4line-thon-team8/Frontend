import type { ConfirmSubject, GradeConfirmDraft } from '../types/gradeConfirm';
import { reviewSubject } from './gradeConfirmValidation';

export function reviewOcrGrades(subjects: ConfirmSubject[], curriculum: GradeConfirmDraft['curriculum']) {
  const reviews = subjects.map(subject => reviewSubject(subject, curriculum));
  const codes = reviews.flatMap(review => review.status === 'included' ? [review.subjectCode] : []);
  const duplicate = new Set(codes).size !== codes.length;
  return { reviews, duplicate, valid: codes.length > 0 && codes.length === subjects.length && !duplicate };
}

export function applyOcrGrades(draft: GradeConfirmDraft, subjects: ConfirmSubject[], confirmed: boolean) {
  if (!confirmed || !reviewOcrGrades(subjects, draft.curriculum).valid) return draft;
  return { ...draft, subjects };
}
