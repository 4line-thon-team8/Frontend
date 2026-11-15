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

export function getOcrSubjectsForReview(draft: GradeConfirmDraft, pending: ConfirmSubject[] | null, hasConfirmedGrades: boolean) {
  if (!pending || !hasConfirmedGrades || draft.subjects.length !== pending.length) return pending;
  const existing = reviewOcrGrades(draft.subjects, draft.curriculum);
  const incoming = reviewOcrGrades(pending, draft.curriculum);
  if (!existing.valid || !incoming.valid) return pending;

  const gradesByCode = new Map(existing.reviews.flatMap(review =>
    review.status === 'included' ? [[review.subjectCode, review.gradeValue] as const] : []));
  const sameGrades = incoming.reviews.every(review =>
    review.status === 'included' && gradesByCode.get(review.subjectCode) === review.gradeValue);
  return sameGrades ? null : pending;
}
