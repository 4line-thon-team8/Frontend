import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export interface PdfTextPage {
  pageNumber: number;
  text: string;
}

export type PdfExtractionResult =
  | { ok: true; pages: PdfTextPage[] }
  | { ok: false; reason: 'format' | 'size' | 'encrypted' | 'invalid' | 'no-text' | 'cancelled' };

/** Reads a local PDF page by page without retaining or uploading the source file. */
export async function extractPdfText(file: File, signal?: AbortSignal): Promise<PdfExtractionResult> {
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

      const pages: PdfTextPage[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const { items } = await page.getTextContent();
        const text = items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
        pages.push({ pageNumber, text });
        page.cleanup();
      }
      return pages.some(page => page.text) ? { ok: true, pages } : { ok: false, reason: 'no-text' };
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
