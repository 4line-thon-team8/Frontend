import type { ConfirmSubject, GradeConfirmDraft } from '../types/gradeConfirm';
import { reviewSubject } from './gradeConfirmValidation';

export function reviewOcrGrades(subjects: ConfirmSubject[], curriculum: GradeConfirmDraft['curriculum']) {
  const reviews = subjects.map(subject => reviewSubject(subject, curriculum));
  const codes = reviews.flatMap(review => review.status === 'included' ? [review.subjectCode] : []);
  const seenCodes = new Set<string>();
  const duplicateCodes = new Set<string>();
  for (const code of codes) {
    if (seenCodes.has(code)) duplicateCodes.add(code);
    seenCodes.add(code);
  }
  const duplicate = duplicateCodes.size > 0;
  // 평균에서 제외되는 과목(성취도만 있는 과목, 과학탐구실험 등)은 수동 입력과 같이 그대로 두고,
  // 과목명이나 등급을 아직 못 읽은 행('review')만 막아요. 서버에는 반영 과목만 보내요.
  const unresolved = reviews.some(review => review.status === 'review');
  return { reviews, duplicate, duplicateCodes, valid: codes.length > 0 && !unresolved && !duplicate };
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
