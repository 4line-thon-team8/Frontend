import type { GradeConfirmDraft } from '../types/gradeConfirm';
import { reviewSubject } from '../utils/gradeConfirmValidation';

export interface SimulationSubjectRow {
  subjectRef: string;
  subjectCode: string;
  gradeValue: number;
}

export function toSimulationSubjectRows(draft: GradeConfirmDraft): SimulationSubjectRow[] | null {
  const rows: SimulationSubjectRow[] = [];
  for (const subject of draft.subjects) {
    const review = reviewSubject(subject, draft.curriculum);
    if (review.status === 'review') return null;
    if (review.status === 'included') {
      rows.push({
        subjectRef: `row-${rows.length + 1}`,
        subjectCode: review.subjectCode,
        gradeValue: review.gradeValue,
      });
    }
  }
  return rows.length ? rows : null;
}
