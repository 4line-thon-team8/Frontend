import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router';
import arrowBack from '../../assets/icons/arrow-back.svg';
import clipboard from '../../assets/icons/clipboard.svg';
import Button from '../../components/common/Button';
import { extractPdfText, MAX_PDF_BYTES } from '../../utils/extractPdfText';
import type { PdfExtractionResult } from '../../utils/extractPdfText';
import './PdfUploadPage.css';

const errorMessages: Record<Exclude<Extract<PdfExtractionResult, { ok: false }>['reason'], 'cancelled'>, string> = {
  format: 'PDF 파일을 선택해 주세요.',
  size: `${MAX_PDF_BYTES / (1024 * 1024)}MB 이하의 PDF 파일을 선택해 주세요.`,
  encrypted: '암호화된 PDF는 읽을 수 없어요. 암호가 없는 PDF를 선택해 주세요.',
  invalid: 'PDF를 읽지 못했어요. 파일이 손상되지 않았는지 확인하고 다시 선택해 주세요.',
  'no-text': '읽을 수 있는 텍스트가 없어요. 스캔한 PDF는 지원하지 않아요.',
};

type UploadStatus =
  | { kind: 'idle' | 'processing' }
  | { kind: 'success'; pageCount: number }
  | { kind: 'error'; message: string };

export default function PdfUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' });

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function selectPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    activeRequest.current?.abort();
    const request = new AbortController();
    activeRequest.current = request;
    setStatus({ kind: 'processing' });

    const result = await extractPdfText(file, request.signal);
    if (request.signal.aborted) return;
    activeRequest.current = null;
    if (result.ok) {
      setStatus({ kind: 'success', pageCount: result.pages.length });
    } else if (result.reason !== 'cancelled') {
      setStatus({ kind: 'error', message: errorMessages[result.reason] });
    }
  }

  return (
    <section className="pdf-upload" aria-labelledby="pdf-upload-title">
      <Link className="pdf-upload-back" to="/grade/input" aria-label="성적표 입력 방법 선택으로 돌아가기">
        <img src={arrowBack} alt="" width="29" height="29" />
      </Link>
      <h1 id="pdf-upload-title">정부24 PDF 업로드</h1>
      <div className="pdf-upload-card">
        <img src={clipboard} alt="" width="36" height="40" />
        <p className="pdf-upload-instructions">
          정부24에서 발급받은 성적증명서 PDF를<br />
          <span>선택해 주세요.</span>
        </p>
        <p className="pdf-upload-hint">PDF · 최대 {MAX_PDF_BYTES / (1024 * 1024)}MB</p>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={selectPdf} />
        <Button onClick={() => inputRef.current?.click()}>
          {status.kind === 'idle' ? 'PDF 파일 선택' : 'PDF 다시 선택'}
        </Button>
      </div>
      <div className="pdf-upload-status" role="status">
        {status.kind === 'processing' && <p>PDF에서 텍스트를 읽고 있어요.</p>}
        {status.kind === 'success' && <p>PDF {status.pageCount}페이지를 처리했어요. 성적 자동 입력은 아직 지원하지 않아요.</p>}
        {status.kind === 'error' && <p className="pdf-upload-error">{status.message}</p>}
      </div>
    </section>
  );
}
