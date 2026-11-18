import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('maps exact names and only replaces the S-03 draft after explicit confirmation', async () => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  try {
    const { applyOcrGrades, getOcrSubjectsForReview, reviewOcrGrades } = await server.ssrLoadModule('/src/utils/applyOcrGrades.ts');
    const existing = [{ id: 'manual', name: '공통수학1', grade: '4' }];
    const draft = { curriculum: '2022', subjects: existing, majorIds: ['existing-major'] };
    const candidates = [{ id: 'ocr-1', name: '국어', grade: '1' }];
    const { searchAllowedSubjects } = await server.ssrLoadModule('/src/utils/subjectCatalog.ts');
    const { createInitialGradeConfirmDraft } = await server.ssrLoadModule('/src/pages/grade/gradeConfirm.mock.ts');
    const firstVisit = createInitialGradeConfirmDraft();
    assert.deepEqual(firstVisit.subjects, []);
    const choices = searchAllowedSubjects('2022', '');
    assert.equal(choices.length, 72);
    const [choice] = searchAllowedSubjects('2022', '공통 국어1');
    assert.equal(choice.name, '공통국어1');
    assert.equal(reviewOcrGrades([{ ...candidates[0], name: choice.name }], '2022').reviews[0].subjectCode, choice.code);
    const recognized = [{ ...candidates[0], name: choice.name }];
    assert.equal(applyOcrGrades(firstVisit, recognized, false), firstVisit);
    assert.deepEqual(applyOcrGrades(firstVisit, recognized, true), { ...firstVisit, subjects: recognized });
    assert.equal(reviewOcrGrades(candidates, draft.curriculum).valid, false);
    assert.equal(applyOcrGrades(draft, candidates, true), draft);

    const edited = [{ ...candidates[0], name: '공통국어1', grade: '2' }];
    const [review] = reviewOcrGrades(edited, draft.curriculum).reviews;
    assert.equal(review.status, 'included');
    assert.ok(review.subjectCode);
    assert.equal(review.gradeValue, 2);
    assert.equal(applyOcrGrades(draft, edited, false), draft);
    assert.equal(applyOcrGrades(draft, [], true), draft);
    assert.equal(applyOcrGrades(draft, [{ ...edited[0], grade: '' }], true), draft);
    assert.equal(applyOcrGrades(draft, [...edited, { ...edited[0], id: 'ocr-2' }], true), draft);
    assert.deepEqual(applyOcrGrades(draft, edited, true), { ...draft, subjects: edited });

    // 성취도만 있거나 석차등급을 산출하지 않는 과목(제외 과목)은 확인 화면을 막지 않아요.
    const withExcluded = [
      ...edited,
      { id: 'ocr-exp', name: '과학탐구실험1', grade: '' },
      { id: 'ocr-letter', name: '통합과학1', grade: 'A' },
    ];
    const excludedReview = reviewOcrGrades(withExcluded, draft.curriculum);
    assert.deepEqual(excludedReview.reviews.map(review => review.status), ['included', 'excluded', 'excluded']);
    assert.equal(excludedReview.valid, true);
    assert.deepEqual(applyOcrGrades(draft, withExcluded, true), { ...draft, subjects: withExcluded });
    // 제외 과목만 있으면 반영할 과목이 없어 막고, 못 읽은 행이 섞여 있어도 막아요.
    assert.equal(reviewOcrGrades(withExcluded.slice(1), draft.curriculum).valid, false);
    assert.equal(reviewOcrGrades([...withExcluded, { id: 'ocr-x', name: '', grade: '2' }], draft.curriculum).valid, false);
    assert.equal(draft.subjects, existing);

    const firstUpload = [...edited, existing[0]];
    assert.equal(getOcrSubjectsForReview(firstVisit, firstUpload, false), firstUpload);
    const confirmedDraft = applyOcrGrades(firstVisit, firstUpload, true);
    assert.equal(getOcrSubjectsForReview(confirmedDraft, null, true), null);
    const sameUpload = [
      { id: 'another-1', name: '공통 국어1', grade: '2' },
      { id: 'another-2', name: '공통수학1', grade: '4' },
    ];
    assert.equal(getOcrSubjectsForReview(confirmedDraft, sameUpload, true), null);
    assert.equal(getOcrSubjectsForReview(confirmedDraft, [...sameUpload].reverse(), true), null);
    const differentUpload = [{ ...sameUpload[0], grade: '3' }, sameUpload[1]];
    assert.equal(getOcrSubjectsForReview(confirmedDraft, differentUpload, true), differentUpload);
    assert.equal(applyOcrGrades(confirmedDraft, differentUpload, false), confirmedDraft);
    assert.deepEqual(applyOcrGrades(confirmedDraft, differentUpload, true), { ...confirmedDraft, subjects: differentUpload });

    const duplicateRows = [
      { id: 'korean-1', name: '공통국어1', grade: '1' },
      { id: 'math-1', name: '공통수학1', grade: '2' },
      { id: 'korean-2', name: '공통 국어1', grade: '3' },
      { id: 'math-2', name: '공통수학1', grade: '4' },
      { id: 'korean-3', name: '공통국어1', grade: '5' },
      { id: 'english', name: '공통영어1', grade: '1' },
    ];
    const duplicateIds = rows => {
      const { reviews, duplicateCodes } = reviewOcrGrades(rows, '2022');
      return rows.filter((_, index) => {
        const review = reviews[index];
        return review.status === 'included' && duplicateCodes.has(review.subjectCode);
      }).map(row => row.id);
    };
    const pair = [duplicateRows[0], duplicateRows[2], duplicateRows[5]];
    assert.deepEqual(duplicateIds(pair), ['korean-1', 'korean-2']);
    assert.deepEqual(duplicateIds(duplicateRows), ['korean-1', 'math-1', 'korean-2', 'math-2', 'korean-3']);
    assert.equal(reviewOcrGrades(duplicateRows, '2022').duplicate, true);
    assert.equal(reviewOcrGrades(duplicateRows, '2022').valid, false);
    assert.equal(applyOcrGrades(draft, duplicateRows, true), draft);

    const renamed = pair.map(row => row.id === 'korean-2' ? { ...row, name: '공통국어2' } : row);
    const deleted = pair.filter(row => row.id !== 'korean-1');
    for (const resolved of [renamed, deleted]) {
      assert.deepEqual(duplicateIds(resolved), []);
      assert.equal(reviewOcrGrades(resolved, '2022').duplicate, false);
      assert.equal(reviewOcrGrades(resolved, '2022').valid, true);
    }
  } finally {
    await server.close();
  }
});
