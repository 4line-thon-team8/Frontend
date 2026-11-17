import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import Button from '../../components/common/Button';
import arrowBack from '../../assets/icons/arrow-back.svg';
import subjectBook from '../../assets/icons/subject-book.svg';
import editPencil from '../../assets/icons/edit-pencil.svg';
import checkCircle from '../../assets/icons/check-circle.svg';
import type { ConfirmSubject } from '../../types/gradeConfirm';
import { useGradeAnalysis } from '../../app/gradeAnalysisContext';
import { getGradeImage } from '../../utils/gradeImageStore';
import { reviewSubject, toggleAdmission, validateGradeConfirm } from '../../utils/gradeConfirmValidation';
import { ADMISSION_OPTIONS, MAJOR_LIMIT } from './gradeConfirm.mock';
import { ApiError } from '../../services/apiClient';
import { getMajors, type Major } from '../../services/lookupApi';
import { createIdempotencyKey, toSimulationSubjectRows } from '../../services/simulationApi';
import { applyOcrGrades, reviewOcrGrades } from '../../utils/applyOcrGrades';
import { searchAllowedSubjects } from '../../utils/subjectCatalog';
import './GradeConfirmPage.css';

const allowedAdmissions = ADMISSION_OPTIONS.map(option => option.id);

type MajorLookup =
  | { status: 'loading' }
  | { status: 'ready'; majors: Major[] }
  | { status: 'error'; message: string };

export default function GradeConfirmPage() {
  const navigate = useNavigate();
  const { draft, setDraft, snapshot, setSnapshot, setResult, narrative, pendingOcrSubjects, setPendingOcrSubjects, setHasConfirmedGrades } = useGradeAnalysis();
  const ocrSubjects = pendingOcrSubjects;
  const subjects = ocrSubjects ?? draft.subjects;
  const ocrReview = ocrSubjects && reviewOcrGrades(ocrSubjects, draft.curriculum);
  const analysisDraft = ocrSubjects ? { ...draft, subjects: ocrSubjects } : draft;
  const [editing, setEditing] = useState(false);
  const focusSubjectId = useRef<string | null>(null);
  const [majorDialogOpen, setMajorDialogOpen] = useState(false);
  const [majorLookup, setMajorLookup] = useState<MajorLookup>({ status: 'loading' });
  const [majorAttempt, setMajorAttempt] = useState(0);
  const [majorQuery, setMajorQuery] = useState('');
  const [imageSource] = useState(() => getGradeImage()?.source ?? null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const majors = majorLookup.status === 'ready' ? majorLookup.majors : [];
  const majorNames = new Map(majors.map(({ code, name }) => [code, name]));
  const selectedMajors = draft.majorIds.filter(code => majorNames.has(code));
  const query = majorQuery.trim().toLowerCase();
  const visibleMajors = majors.filter(major => major.name.toLowerCase().includes(query));
  const errors = validateGradeConfirm(analysisDraft, {
    maxMajors: MAJOR_LIMIT,
    allowedMajorIds: [...majorNames.keys()],
    allowedAdmissions,
  });
  const analysisBlocked = editing || errors.length > 0 || (ocrReview !== null && !ocrReview.valid);

  function updateSubjects(update: (current: ConfirmSubject[]) => ConfirmSubject[]) {
    if (ocrSubjects) {
      setPendingOcrSubjects(current => current === null ? null : update(current));
    } else {
      setDraft(current => ({ ...current, subjects: update(current.subjects) }));
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void getMajors(controller.signal).then(majors => {
      if (controller.signal.aborted) return;
      const codes = new Set(majors.map(major => major.code));
      setDraft(current => {
        const majorIds = current.majorIds.filter(code => codes.has(code));
        return majorIds.length === current.majorIds.length ? current : { ...current, majorIds };
      });
      setMajorLookup({ status: 'ready', majors });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      let message = '학과 목록 응답을 읽을 수 없어요.';
      if (error instanceof ApiError) {
        message = `학과 목록을 불러오지 못했어요. (HTTP ${error.status})`;
      } else if (error instanceof TypeError) {
        message = '네트워크 연결을 확인한 후 다시 시도해 주세요.';
      }
      setMajorLookup({ status: 'error', message });
    });
    return () => controller.abort();
  }, [majorAttempt, setDraft]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (majorDialogOpen) {
      dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
    }
  }, [majorDialogOpen]);

  function updateSubject(id: string, field: 'name' | 'grade', value: string) {
    updateSubjects(current => current.map(subject => subject.id === id
      ? { ...subject, [field]: value } : subject));
  }

  function addSubject() {
    updateSubjects(current => {
      const usedIds = new Set(current.map(subject => subject.id));
      let sequence = current.length + 1;
      while (usedIds.has(`added-${sequence}`)) sequence++;
      return [...current, { id: `added-${sequence}`, name: '', grade: '' }];
    });
  }

  function removeSubject(id: string) {
    updateSubjects(current => current.filter(subject => subject.id !== id));
  }

  function finishEditing() {
    setEditing(false);
  }

  function toggleMajor(code: string) {
    if (!majorNames.has(code)) return;
    setDraft(current => {
      if (current.majorIds.includes(code)) {
        return { ...current, majorIds: current.majorIds.filter(value => value !== code) };
      }
      if (current.majorIds.length >= MAJOR_LIMIT) return current;
      return { ...current, majorIds: [...current.majorIds, code] };
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (analysisBlocked) return;
    const subjects = toSimulationSubjectRows(analysisDraft);
    if (!subjects) return;
    if (ocrSubjects) {
      setDraft(current => applyOcrGrades(current, ocrSubjects, true));
      setPendingOcrSubjects(null);
    }
    setHasConfirmedGrades(true);
    const preferences = {
      majorIds: [...draft.majorIds],
      admissions: [...draft.admissions],
      includeReach: draft.includeReach,
      expandSimilarMajors: draft.expandSimilarMajors,
    };
    // 서술을 읽어 분석에 성공했을 때만 보내요. 서술이 짧거나 구분하지 못했으면 성적만으로 분석해요.
    const holisticAnalysis = narrative?.ok ? narrative.payload : null;
    // 입력이 그대로면(예: 세션 만료 후 재로그인해서 다시 분석) 같은 Idempotency-Key 로 재시도하고,
    // 입력이 바뀌었으면 새 분석이라 새 키를 만들어요. 서술 분석도 요청 내용이라 함께 비교해요.
    const sameRequest = snapshot !== null
      && JSON.stringify([snapshot.subjects, snapshot.preferences, snapshot.holisticAnalysis])
        === JSON.stringify([subjects, preferences, holisticAnalysis]);
    setSnapshot({
      subjects,
      preferences,
      // 리포트 요약의 '희망 학과' 표시용 (학과 목록은 이 화면에서만 불러와요)
      majorNames: preferences.majorIds.map(code => majorNames.get(code) ?? code),
      holisticAnalysis,
      idempotencyKey: sameRequest && snapshot ? snapshot.idempotencyKey : createIdempotencyKey(),
    });
    setResult(null);
    setEditing(false);
    navigate('/grade/loading');
  }

  function subjectRow(subject: ConfirmSubject, index: number) {
    const review = reviewSubject(subject, draft.curriculum);
    // 제외 과목은 확인이 필요 없어요. 과목명을 못 찾았거나(이름), 반영 과목인데 등급이 1~5가 아닌 경우(등급)만 표시해요.
    const invalidName = review.status === 'review' && !('subjectCode' in review);
    const invalidGrade = review.status === 'review' && 'subjectCode' in review;
    const needsReview = invalidName || invalidGrade;
    const statusId = `subject-status-${subject.id}`;
    const displayName = 'subjectName' in review ? review.subjectName : subject.name || '과목명 미인식';
    const grade = subject.grade.trim();
    const displayGrade = /^[1-5]$/u.test(grade) ? `${grade}등급` : grade;
    return (
      <li className={`grade-confirm-subject${needsReview && !ocrSubjects ? ' needs-review' : ''}`} key={subject.id}>
        <div className="grade-confirm-subject-fields">
          <div className="grade-confirm-subject-name">
            <img src={subjectBook} alt="" width="24" height="24" />
            {editing ? <input ref={input => {
              if (!input || focusSubjectId.current !== subject.id) return;
              focusSubjectId.current = null;
              input.focus();
            }} aria-label={`${index + 1}번째 과목명`} list={ocrSubjects ? 'ocr-confirm-subject-names' : undefined} value={subject.name} maxLength={40} onChange={event => updateSubject(subject.id, 'name', event.target.value)} placeholder="과목명" aria-describedby={statusId} aria-invalid={invalidName} />
              : ocrSubjects && invalidName
                ? <button type="button" className="grade-confirm-subject-edit-name" aria-label={`${displayName} 과목명 수정`} aria-describedby={statusId} onClick={() => {
                  focusSubjectId.current = subject.id;
                  setEditing(true);
                }}>{displayName}</button>
                : <span>{displayName}</span>}
          </div>
          <div className="grade-confirm-subject-grade">
            {editing ? <><input type="text" inputMode={ocrSubjects ? 'numeric' : undefined} maxLength={8} aria-label={`${subject.name || `${index + 1}번째 과목`} 등급`} value={subject.grade} onChange={event => updateSubject(subject.id, 'grade', event.target.value)} aria-describedby={statusId} aria-invalid={invalidGrade} /><span>등급</span>
              <button type="button" className="grade-confirm-delete" aria-label={`${subject.name || '새 과목'} 삭제`} onClick={() => removeSubject(subject.id)}>삭제</button></> : <span>{displayGrade}</span>}
          </div>
        </div>
        <p className={`grade-confirm-subject-status${ocrSubjects && needsReview ? ' grade-confirm-subject-check' : ''}`} id={statusId}>
          {ocrSubjects && needsReview ? invalidName && invalidGrade ? '과목·등급 확인' : invalidName ? '확인 필요' : '등급 확인'
            : review.status === 'included'
            ? `평균 반영 · ${review.subjectName}`
            : `${needsReview ? '확인 필요' : '평균 제외'} · ${review.message}`}
        </p>
      </li>
    );
  }

  return (
    <div className="grade-confirm-page" data-image-source={imageSource ?? undefined}>
      <header className="grade-confirm-header">
        <Link to="/grade/input" replace aria-label="성적표 입력 방법 선택으로 돌아가기"><img src={arrowBack} alt="" width="29" height="29" /></Link>
      </header>
      <section className="grade-confirm-intro" aria-labelledby="grade-confirm-title">
        <h1 id="grade-confirm-title">읽어온 값이 맞는지 확인하고,<br />틀리면 고쳐주세요.</h1>
        <p>2022 개정 교육과정의 5등급제 성적을 확인해 주세요.</p>
      </section>
      <form onSubmit={submit} noValidate>
        <section className="grade-confirm-grades" aria-labelledby="grade-confirm-subject-title">
          <div className="grade-confirm-section-heading">
            <h2 id="grade-confirm-subject-title">과목</h2>
            {!editing && <button type="button" className="grade-confirm-edit" onClick={() => setEditing(true)}><img src={editPencil} alt="" width="12" height="12" />수정하기</button>}
          </div>
          <p className="grade-confirm-field-hint">국수영사과(한국사 포함) 참고 평균의 반영 여부를 확인해 주세요. 대학별 반영 방식과 다를 수 있습니다.</p>
          {ocrSubjects && <datalist id="ocr-confirm-subject-names">{searchAllowedSubjects(draft.curriculum, '').map(subject =>
            <option key={subject.code} value={subject.name} />)}</datalist>}
          <ul className="grade-confirm-subjects" aria-label={ocrSubjects ? '확정 전 OCR 성적' : undefined}>{subjects.map(subjectRow)}</ul>
          {editing && <><button type="button" className="grade-confirm-add-subject" onClick={addSubject}>+ 과목 추가</button><p className="grade-confirm-field-hint">성적표의 과목명과 석차등급(1~5)을 입력해 주세요. 성취도만 기록된 경우 A~E 또는 P를 입력해 주세요.</p><Button type="button" className="grade-confirm-finish" onClick={finishEditing}>수정 완료</Button></>}
          {ocrReview?.duplicate && <p>중복 과목을 확인하고 한 행만 남겨 주세요.</p>}
        </section>
        <section className="grade-confirm-directions" aria-labelledby="grade-confirm-direction-title">
          <div className="grade-confirm-direction-heading"><h2 id="grade-confirm-direction-title">지원 방향</h2><span>희망 학과 (1~3)</span></div>
          <div className="grade-confirm-major-chips" aria-label="선택한 희망 학과">
            {selectedMajors.map(code => <button type="button" key={code} className="grade-confirm-major-chip" onClick={() => toggleMajor(code)}>{majorNames.get(code)}<span className="grade-confirm-sr-only"> 삭제</span></button>)}
            <button type="button" className="grade-confirm-add-major" aria-label="희망 학과 추가" onClick={() => setMajorDialogOpen(true)}>+ 추가</button>
          </div>
          <fieldset className="grade-confirm-admissions">
            <legend>선호하는 전형 <span>*1개 이상 선택해 주세요.</span></legend>
            {ADMISSION_OPTIONS.map(option => <label className="grade-confirm-admission" key={option.id}>
              <input type="checkbox" checked={draft.admissions.includes(option.id)} onChange={() => { setDraft(current => ({ ...current, admissions: toggleAdmission(current.admissions, option.id) })); }} />
              <img src={checkCircle} alt="" width="24" height="24" />
              <span>{option.name}</span>
            </label>)}
          </fieldset>
          <div className="grade-confirm-options">
            <label><span>상향 지원 카드 포함</span><input role="switch" type="checkbox" checked={draft.includeReach} onChange={event => { setDraft(current => ({ ...current, includeReach: event.target.checked })); }} /></label>
            <label><span>비슷한 학과로 확대</span><input role="switch" type="checkbox" checked={draft.expandSimilarMajors} onChange={event => { setDraft(current => ({ ...current, expandSimilarMajors: event.target.checked })); }} /></label>
          </div>
          <div className="grade-confirm-submit">
            <Button type="submit" className="grade-confirm-analyze" disabled={analysisBlocked} aria-describedby="grade-confirm-validation">분석하기</Button>
            <div id="grade-confirm-validation" className="grade-confirm-validation" aria-live="polite">
              {ocrReview && !ocrReview.valid && <p>인식된 과목과 석차등급을 확인해 주세요.</p>}
              {errors.map(error => <p key={error}>{error}</p>)}
            </div>
          </div>
        </section>
      </form>
      <dialog ref={dialogRef} className="grade-confirm-dialog" aria-labelledby="grade-confirm-dialog-title" onCancel={event => { event.preventDefault(); setMajorDialogOpen(false); }} onClick={event => { if (event.target === event.currentTarget) setMajorDialogOpen(false); }}>
          <h2 id="grade-confirm-dialog-title">희망 학과 선택</h2>
          <p>최대 {MAJOR_LIMIT}개까지 선택할 수 있어요.</p>
          {majorLookup.status === 'loading' && <p role="status">학과 목록을 불러오고 있어요.</p>}
          {majorLookup.status === 'error' && <>
            <p role="alert">{majorLookup.message}</p>
            <Button type="button" onClick={() => {
              setMajorLookup({ status: 'loading' });
              setMajorAttempt(attempt => attempt + 1);
            }}>다시 시도</Button>
          </>}
          {majorLookup.status === 'ready' && (majors.length === 0
            ? <p role="status">등록된 학과가 없어요.</p>
            : <>
              <input className="grade-confirm-major-search" type="search" aria-label="학과명 검색" placeholder="학과명 검색" value={majorQuery} onChange={event => setMajorQuery(event.target.value)} />
              {visibleMajors.length === 0 ? <p role="status">검색 결과가 없어요.</p>
                : <div className="grade-confirm-major-options">{visibleMajors.map(({ code, name }) => {
                  const selected = draft.majorIds.includes(code);
                  return <button type="button" key={code} aria-pressed={selected} disabled={!selected && selectedMajors.length >= MAJOR_LIMIT} onClick={() => toggleMajor(code)}>{name}</button>;
                })}</div>}
            </>)}
          <p className="grade-confirm-major-count" aria-live="polite">{selectedMajors.length} / {MAJOR_LIMIT}개 선택</p>
          <Button className="grade-confirm-dialog-done" onClick={() => setMajorDialogOpen(false)}>완료</Button>
      </dialog>
    </div>
  );
}
