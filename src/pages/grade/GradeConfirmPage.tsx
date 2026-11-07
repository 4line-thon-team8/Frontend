import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import Button from '../../components/common/Button';
import arrowBack from '../../assets/icons/arrow-back.svg';
import subjectBook from '../../assets/icons/subject-book.svg';
import editPencil from '../../assets/icons/edit-pencil.svg';
import checkCircle from '../../assets/icons/check-circle.svg';
import type { ConfirmSubject, GradeConfirmDraft } from '../../types/gradeConfirm';
import { clearGradeImage, getGradeImage } from '../../utils/gradeImageStore';
import { isValidSubject, toggleAdmission, validateGradeConfirm } from '../../utils/gradeConfirmValidation';
import { ADMISSION_OPTIONS, createMockGradeConfirmDraft, MOCK_GRADE_LIMITS, MOCK_MAJOR_LIMIT, MOCK_MAJORS } from './gradeConfirm.mock';
import './GradeConfirmPage.css';

const rules = {
  minGrade: MOCK_GRADE_LIMITS.min,
  maxGrade: MOCK_GRADE_LIMITS.max,
  maxMajors: MOCK_MAJOR_LIMIT,
  allowedMajorIds: MOCK_MAJORS.map(major => major.id),
  allowedAdmissions: ADMISSION_OPTIONS.map(option => option.id),
};

export default function GradeConfirmPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<GradeConfirmDraft>(createMockGradeConfirmDraft);
  const [editing, setEditing] = useState(false);
  const [dialogKind, setDialogKind] = useState<'majors' | 'reset' | null>(null);
  const [notice, setNotice] = useState('');
  // 원본 이미지를 추가 저장/표시하지 않고 기존 입력 출처만 읽습니다. 성적은 명시적인 목업입니다.
  const [imageSource] = useState(() => getGradeImage()?.source ?? null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nextSubjectId = useRef(0);
  const errors = validateGradeConfirm(draft, rules);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogKind) {
      dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
    }
  }, [dialogKind]);

  function updateSubject(id: string, field: 'name' | 'grade', value: string) {
    setNotice('');
    setDraft(current => ({ ...current, subjects: current.subjects.map(subject => subject.id === id
      ? { ...subject, [field]: value, needsReview: false } : subject) }));
  }

  function addSubject() {
    const id = `added-${++nextSubjectId.current}`;
    setDraft(current => ({ ...current, subjects: [...current.subjects, { id, name: '', grade: '', needsReview: false }] }));
    setNotice('');
  }

  function removeSubject(id: string) {
    setDraft(current => ({ ...current, subjects: current.subjects.filter(subject => subject.id !== id) }));
    setNotice('');
  }

  function finishEditing() {
    if (!draft.subjects.length || draft.subjects.some(subject => !isValidSubject(subject.name, subject.grade, rules))) {
      setNotice('과목명과 1~9 사이의 정수 등급을 확인해주세요.');
      return;
    }
    setEditing(false);
    setNotice('');
  }

  function toggleMajor(id: string) {
    setDraft(current => ({ ...current, majorIds: current.majorIds.includes(id)
      ? current.majorIds.filter(value => value !== id)
      : current.majorIds.length < MOCK_MAJOR_LIMIT ? [...current.majorIds, id] : current.majorIds }));
    setNotice('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (errors.length) return;
    setEditing(false);
    setNotice('입력값 확인을 완료했습니다. 분석 API는 아직 연결되지 않았습니다.');
  }

  function resetInput() {
    clearGradeImage();
    setDraft(createMockGradeConfirmDraft());
    setDialogKind(null);
    navigate('/grade/input');
  }

  function subjectRow(subject: ConfirmSubject, index: number) {
    const invalid = !isValidSubject(subject.name, subject.grade, rules);
    return (
      <li className={`grade-confirm-subject${subject.needsReview ? ' needs-review' : ''}`} key={subject.id}>
        <div className="grade-confirm-subject-name">
          <img src={subjectBook} alt="" width="24" height="24" />
          {editing ? <input aria-label={`${index + 1}번째 과목명`} value={subject.name} maxLength={40} onChange={event => updateSubject(subject.id, 'name', event.target.value)} placeholder="과목명" aria-invalid={!subject.name.trim()} /> : <span>{subject.name}</span>}
        </div>
        <div className="grade-confirm-subject-grade">
          {editing ? <><input type="number" inputMode="numeric" min={MOCK_GRADE_LIMITS.min} max={MOCK_GRADE_LIMITS.max} step="1" aria-label={`${subject.name || `${index + 1}번째 과목`} 등급`} value={subject.grade} onChange={event => updateSubject(subject.id, 'grade', event.target.value)} aria-invalid={invalid} /><span>등급</span>
            <button type="button" className="grade-confirm-delete" aria-label={`${subject.name || '새 과목'} 삭제`} onClick={() => removeSubject(subject.id)}>삭제</button></> : <span>{subject.grade} 등급</span>}
          {subject.needsReview && <span className="grade-confirm-sr-only">인식값 확인 필요</span>}
        </div>
      </li>
    );
  }

  return (
    <div className="grade-confirm-page" data-image-source={imageSource ?? undefined}>
      <header className="grade-confirm-header">
        <Link to="/grade/input" aria-label="성적표 입력 방법 선택으로 돌아가기"><img src={arrowBack} alt="" width="29" height="29" /></Link>
      </header>
      <section className="grade-confirm-intro" aria-labelledby="grade-confirm-title">
        <h1 id="grade-confirm-title">읽어온 값이 맞는지 확인하고,<br />틀리면 고쳐주세요.</h1>
        <p>*인식 이후 신뢰도가 낮은 항목은 노란색으로 표시됩니다.</p>
      </section>
      <form onSubmit={submit} noValidate>
        <section className="grade-confirm-grades" aria-labelledby="grade-confirm-subject-title">
          <div className="grade-confirm-section-heading">
            <h2 id="grade-confirm-subject-title">과목</h2>
            <button type="button" className="grade-confirm-edit" aria-pressed={editing} onClick={() => editing ? finishEditing() : setEditing(true)}><img src={editPencil} alt="" width="12" height="12" />{editing ? '수정 완료' : '수정하기'}</button>
          </div>
          <ul className="grade-confirm-subjects">{draft.subjects.map(subjectRow)}</ul>
          {editing && <><button type="button" className="grade-confirm-add-subject" onClick={addSubject}>+ 과목 추가</button><p className="grade-confirm-field-hint">목업 기준: 모든 과목에 과목명과 1~9등급을 입력해주세요.</p></>}
        </section>
        <section className="grade-confirm-directions" aria-labelledby="grade-confirm-direction-title">
          <div className="grade-confirm-direction-heading"><h2 id="grade-confirm-direction-title">지원 방향</h2><span>희망 학과 (1~3)</span></div>
          <div className="grade-confirm-major-chips" aria-label="선택한 희망 학과">
            {draft.majorIds.map(id => <button type="button" key={id} className="grade-confirm-major-chip" aria-label={`${MOCK_MAJORS.find(major => major.id === id)?.name} 삭제`} onClick={() => toggleMajor(id)}>{MOCK_MAJORS.find(major => major.id === id)?.name}<span className="grade-confirm-sr-only"> 삭제</span></button>)}
            <button type="button" className="grade-confirm-add-major" aria-label="희망 학과 추가" onClick={() => setDialogKind('majors')}>+ 추가</button>
          </div>
          <fieldset className="grade-confirm-admissions">
            <legend>선호하는 전형 <span>*1개 이상 선택해 주세요.</span></legend>
            {ADMISSION_OPTIONS.map(option => <label className="grade-confirm-admission" key={option.id}>
              <input type="checkbox" checked={draft.admissions.includes(option.id)} onChange={() => { setDraft(current => ({ ...current, admissions: toggleAdmission(current.admissions, option.id) })); setNotice(''); }} />
              <img src={checkCircle} alt="" width="24" height="24" />
              <span>{option.name}</span>
            </label>)}
          </fieldset>
          <div className="grade-confirm-options">
            <label><span>상향 지원 카드 포함</span><input role="switch" type="checkbox" checked={draft.includeReach} onChange={event => { setDraft(current => ({ ...current, includeReach: event.target.checked })); setNotice(''); }} /></label>
            <label><span>비슷한 학과로 확대</span><input role="switch" type="checkbox" checked={draft.expandSimilarMajors} onChange={event => { setDraft(current => ({ ...current, expandSimilarMajors: event.target.checked })); setNotice(''); }} /></label>
          </div>
          <div className="grade-confirm-submit">
            <Button type="submit" className="grade-confirm-analyze" disabled={errors.length > 0} aria-describedby="grade-confirm-validation">분석하기</Button>
            <div id="grade-confirm-validation" className="grade-confirm-validation" aria-live="polite">{errors.map(error => <p key={error}>{error}</p>)}</div>
            <p className="grade-confirm-notice" role="status">{notice}</p>
          </div>
        </section>
      </form>
      <dialog ref={dialogRef} className="grade-confirm-dialog" aria-labelledby="grade-confirm-dialog-title" onCancel={event => { event.preventDefault(); setDialogKind(null); }} onClick={event => { if (event.target === event.currentTarget) setDialogKind(null); }}>
        {dialogKind === 'majors' ? <>
          <h2 id="grade-confirm-dialog-title">희망 학과 선택</h2>
          <p>임시 학과 목록입니다. 최대 3개까지 선택할 수 있어요.</p>
          <div className="grade-confirm-major-options">{MOCK_MAJORS.map(major => <button type="button" key={major.id} aria-pressed={draft.majorIds.includes(major.id)} disabled={!draft.majorIds.includes(major.id) && draft.majorIds.length >= MOCK_MAJOR_LIMIT} onClick={() => toggleMajor(major.id)}>{major.name}</button>)}</div>
          <p className="grade-confirm-major-count" aria-live="polite">{draft.majorIds.length} / {MOCK_MAJOR_LIMIT}개 선택</p>
          <Button className="grade-confirm-dialog-done" onClick={() => setDialogKind(null)}>완료</Button>
        </> : <>
          <h2 id="grade-confirm-dialog-title">다시 입력하면 지금 내용이 사라져요</h2>
          <div className="grade-confirm-dialog-actions"><Button className="grade-confirm-dialog-cancel" onClick={() => setDialogKind(null)}>취소</Button><Button onClick={resetInput}>계속</Button></div>
        </>}
      </dialog>
    </div>
  );
}
