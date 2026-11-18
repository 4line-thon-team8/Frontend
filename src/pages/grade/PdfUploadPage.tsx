import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import arrowBack from '../../assets/icons/arrow-back.svg';
import clipboard from '../../assets/icons/clipboard.svg';
import { useGradeAnalysis } from '../../app/gradeAnalysisContext';
import Button from '../../components/common/Button';
import { analyzeNarrative } from '../../utils/holistic/analyzeNarrative';
import { createPageOcr } from '../../utils/createPageOcr';
import { extractPdfText, MAX_PDF_BYTES } from '../../utils/extractPdfText';
import type { PdfExtractionResult } from '../../utils/extractPdfText';
import { parseRecordGrades } from '../../utils/parseRecordGrades';
import { snapSubjectName } from '../../utils/subjectCatalog';
import './PdfUploadPage.css';

const errorMessages: Record<Exclude<Extract<PdfExtractionResult, { ok: false }>['reason'], 'cancelled'>, string> = {
  format: 'PDF 파일을 선택해 주세요.',
  size: `${MAX_PDF_BYTES / (1024 * 1024)}MB 이하의 PDF 파일을 선택해 주세요.`,
  encrypted: '암호화된 PDF는 읽을 수 없어요. 암호가 없는 PDF를 선택해 주세요.',
  invalid: 'PDF를 읽지 못했어요. 파일이 손상되지 않았는지 확인하고 다시 선택해 주세요.',
  'no-text': '읽을 수 있는 텍스트가 없어요. 스캔 상태가 흐리지 않은지 확인하고 다시 선택해 주세요.',
  ocr: '스캔한 PDF의 글자를 읽지 못했어요. 잠시 후 다시 시도하거나 성적표를 사진으로 촬영해 주세요.',
};

type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'processing'; pageNumber: number; pageCount: number; scanned: boolean }
  // 서술 분석은 반영됐지만 교과학습발달상황 표에서 성적을 찾지 못한 경우예요.
  | { kind: 'no-grades'; pageCount: number }
  | { kind: 'error'; message: string };

export default function PdfUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const { setNarrative, setPendingOcrSubjects } = useGradeAnalysis();
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' });

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function selectPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    activeRequest.current?.abort();
    const request = new AbortController();
    activeRequest.current = request;
    setStatus({ kind: 'processing', pageNumber: 0, pageCount: 0, scanned: false });

    // 글자 레이어가 없는 스캔 페이지만 OCR 워커로 읽어요. 글자 PDF는 워커를 만들기만 하고 쓰지 않아요.
    const ocr = createPageOcr(request.signal);
    let result: PdfExtractionResult;
    try {
      result = await extractPdfText(file, request.signal, {
        recognizePage: image => ocr.recognize(image),
        concurrency: ocr.concurrency,
        onProgress: progress => { if (!request.signal.aborted) setStatus({ kind: 'processing', ...progress }); },
      });
    } finally {
      ocr.dispose();
    }
    if (request.signal.aborted) return;
    activeRequest.current = null;
    if (result.ok) {
      // 페이지를 이어 붙여 분석해요(영역이 페이지 경계에서 끊기는 경우 대비). 전문은 여기서만 쓰고 저장하지 않아요.
      const text = result.pages.map(page => page.text).join('\n');
      setNarrative(analyzeNarrative(text));
      const subjects = parseRecordGrades(text).map(subject => ({ ...subject, name: snapSubjectName(subject.name, '2022') }));
      if (subjects.length) {
        setPendingOcrSubjects(subjects);
        navigate('/grade/confirm', { replace: true });
        return;
      }
      setPendingOcrSubjects(null);
      setStatus({ kind: 'no-grades', pageCount: result.pages.length });
    } else if (result.reason !== 'cancelled') {
      setNarrative(null);
      setPendingOcrSubjects(null);
      setStatus({ kind: 'error', message: errorMessages[result.reason] });
    }
  }

  function cancel() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setStatus({ kind: 'idle' });
  }

  return (
    <section className="pdf-upload" aria-labelledby="pdf-upload-title">
      <Link className="pdf-upload-back" to="/grade/input" aria-label="성적표 입력 방법 선택으로 돌아가기">
        <img src={arrowBack} alt="" width="29" height="29" />
      </Link>
      <h1 id="pdf-upload-title">PDF 업로드</h1>
      <div className="pdf-upload-card">
        <img src={clipboard} alt="" width="36" height="40" />
        <p className="pdf-upload-instructions">
          생활기록부 PDF를<br />
          <span>선택해 주세요.</span>
        </p>
        <p className="pdf-upload-hint">PDF · 최대 {MAX_PDF_BYTES / (1024 * 1024)}MB</p>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={selectPdf} />
        <Button onClick={() => inputRef.current?.click()}>
          {status.kind === 'idle' ? 'PDF 파일 선택' : 'PDF 다시 선택'}
        </Button>
      </div>
      <div className="pdf-upload-status" role="status">
        {status.kind === 'processing' && <>
          <p>
            {status.scanned
              ? `스캔한 문서라 글자로 바꾸는 중이에요 (${status.pageNumber}/${status.pageCount}페이지). 몇 분 걸릴 수 있어요.`
              : 'PDF에서 텍스트를 읽고 있어요.'}
          </p>
          <button type="button" className="pdf-upload-cancel" onClick={cancel}>취소</button>
        </>}
        {status.kind === 'no-grades' && <>
          <p>PDF {status.pageCount}페이지를 읽었지만 교과학습발달상황 성적표를 찾지 못했어요. 서술 내용만 분석에 반영돼요.</p>
          <p><Link to="/grade/camera">성적표를 사진으로 촬영</Link>하거나 <Link to="/grade/input">다른 방법</Link>으로 성적을 넣어 주세요.</p>
        </>}
        {status.kind === 'error' && <p className="pdf-upload-error">{status.message}</p>}
      </div>
    </section>
  );
}
