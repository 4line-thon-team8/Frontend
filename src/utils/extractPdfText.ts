import type { PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

// 글자 레이어가 이보다 짧은 페이지는 '글자가 없는 페이지'로 봐요. 스캔본에 섞여 있는 몇 글자짜리
// 깨진 글자 레이어를 글자가 있는 PDF로 오해하지 않기 위한 기준이에요.
const MIN_PAGE_TEXT_LENGTH = 30;
// 스캔 페이지를 이미지로 그릴 때의 배율(200dpi)과 최대 화소 수예요. 표 칸을 찾고 작은 글씨를 읽으려면 이 정도가 필요해요.
const OCR_RENDER_SCALE = 200 / 72;
const OCR_MAX_PIXELS = 12_000_000;

export interface PdfTextPage {
  pageNumber: number;
  text: string;
  /** 'ocr'이면 글자 레이어가 없어 페이지 이미지를 OCR로 읽은 결과예요. */
  source: 'text' | 'ocr';
}

export type PdfExtractionResult =
  | { ok: true; pages: PdfTextPage[] }
  | { ok: false; reason: 'format' | 'size' | 'encrypted' | 'invalid' | 'no-text' | 'ocr' | 'cancelled' };

export interface PdfExtractionOptions {
  /** 글자 레이어가 없는 페이지(스캔본)의 이미지를 받아 글자를 읽어요. 없으면 글자 레이어만 사용해요. */
  recognizePage?: (image: Blob) => Promise<string>;
  /** 동시에 OCR에 맡길 스캔 페이지 수예요. 페이지를 그리는 동안 앞 페이지를 읽어서 전체 시간이 줄어요. 기본 1. */
  concurrency?: number;
  /** 페이지를 처리하기 시작할 때 불려요. scanned가 true면 OCR이 필요한 페이지예요. */
  onProgress?: (progress: { pageNumber: number; pageCount: number; scanned: boolean }) => void;
}

async function renderPageImage(page: PDFPageProxy): Promise<Blob> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(OCR_RENDER_SCALE, Math.sqrt(OCR_MAX_PIXELS / (base.width * base.height)));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  try {
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) throw new Error('Canvas unavailable');
    await page.render({ canvas, canvasContext, viewport }).promise;
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Page image unavailable')), 'image/png'));
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Reads a local PDF page by page without retaining or uploading the source file. */
export async function extractPdfText(
  file: File,
  signal?: AbortSignal,
  options: PdfExtractionOptions = {},
): Promise<PdfExtractionResult> {
  if (!/\.pdf$/iu.test(file.name)) return { ok: false, reason: 'format' };
  if (file.size > MAX_PDF_BYTES) return { ok: false, reason: 'size' };

  try {
    const header = await file.slice(0, 5).text();
    if (header !== '%PDF-') return { ok: false, reason: 'invalid' };

    const { getDocument, GlobalWorkerOptions, PasswordException, VerbosityLevel } =
      await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await file.arrayBuffer());
    signal?.throwIfAborted();
    GlobalWorkerOptions.workerSrc = workerUrl;
    const task = getDocument({ data, stopAtErrors: true, verbosity: VerbosityLevel.ERRORS });

    function cancel() {
      void task.destroy().catch(() => {});
    }

    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const document = await task.promise;
      const { info } = await document.getMetadata();
      if ('EncryptFilterName' in info && info.EncryptFilterName) {
        return { ok: false, reason: 'encrypted' };
      }

      const concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
      const pages: PdfTextPage[] = [];
      const inFlight = new Set<Promise<void>>();
      let ocrFailed = false;

      // 페이지 이미지를 그리는 건 메인 스레드에서 차례로 하고, 글자 읽기는 동시에 여러 장 맡겨요.
      // 결과는 페이지 번호 자리(pages[번호-1])에 넣어서 읽기가 끝나는 순서와 상관없이 순서가 유지돼요.
      function startOcr(pageNumber: number, image: Blob, recognizePage: (image: Blob) => Promise<string>) {
        const job: Promise<void> = recognizePage(image)
          .then(text => { pages[pageNumber - 1] = { pageNumber, text: text.trim(), source: 'ocr' }; })
          .catch(() => { ocrFailed = true; })
          .finally(() => { inFlight.delete(job); });
        inFlight.add(job);
      }

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        signal?.throwIfAborted();
        if (ocrFailed) break;
        const page = await document.getPage(pageNumber);
        const { items } = await page.getTextContent();
        const text = items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
        const scanned = text.length < MIN_PAGE_TEXT_LENGTH;
        options.onProgress?.({ pageNumber, pageCount: document.numPages, scanned: scanned && !!options.recognizePage });
        if (scanned && options.recognizePage) {
          while (inFlight.size >= concurrency) await Promise.race(inFlight);
          if (ocrFailed) break;
          startOcr(pageNumber, await renderPageImage(page), options.recognizePage);
        } else {
          pages[pageNumber - 1] = { pageNumber, text, source: 'text' };
        }
        page.cleanup();
      }
      await Promise.all(inFlight);
      signal?.throwIfAborted();
      if (ocrFailed) return { ok: false, reason: 'ocr' };
      return pages.some(page => page.text.length >= MIN_PAGE_TEXT_LENGTH)
        ? { ok: true, pages } : { ok: false, reason: 'no-text' };
    } catch (error) {
      if (error instanceof PasswordException) return { ok: false, reason: 'encrypted' };
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
      await task.destroy();
    }
  } catch {
    return { ok: false, reason: signal?.aborted ? 'cancelled' : 'invalid' };
  }
}
