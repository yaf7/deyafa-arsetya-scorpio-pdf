import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

export type ExtractMode = 'merged' | 'separate';

export interface ExtractPageThumbnail {
  pageNum: number; // 1-indexed
  width: number;
  height: number;
  aspectRatio: number;
  thumbnailUrl: string;
}

export interface InspectExtractPagesResult {
  file: File;
  fileName: string;
  fileSize: number;
  pageCount: number;
  pages: ExtractPageThumbnail[];
}

export interface ExtractPagesOptions {
  mode: ExtractMode;
  selectedPages: Set<number>;
  outputName?: string;
}

export interface GeneratedExtractPagesResult {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  originalPageCount: number;
  extractedPageCount: number;
  mode: ExtractMode;
  extractedPagesList: number[];
  isZip: boolean;
  subFilesCount: number;
}

// Inisialisasi pdfjs-dist secara aman di browser
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('Ekstrak Halaman PDF hanya dapat dijalankan di browser.');
  }

  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((pdfjs) => {
      if (typeof window !== 'undefined') {
        const workerUrl = `${window.location.origin}/pdf.worker.min.mjs`;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      }
      return pdfjs;
    });
  }

  return pdfjsLibPromise;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function stripPdfExtension(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '');
}

export function sanitizePdfFilename(name: string, fallback = 'dokumen-ekstrak'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

export function sanitizeZipFilename(name: string, fallback = 'dokumen-ekstrak-zip'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.zip') ? base : `${base}.zip`;
}

/**
 * Parsing teks rentang halaman (misal: "1, 3-5, 8, 12") menjadi Set nomor halaman 1-indexed
 */
export function parsePageRangeInput(input: string, maxPages: number): Set<number> {
  const result = new Set<number>();
  if (!input || !input.trim()) return result;

  const parts = input.split(/[,;\s]+/).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end)) {
        const from = Math.max(1, Math.min(start, end));
        const to = Math.min(maxPages, Math.max(start, end));
        for (let i = from; i <= to; i++) {
          result.add(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= maxPages) {
        result.add(num);
      }
    }
  }

  return result;
}

/**
 * Format nomor halaman menjadi teks ringkas rentang (misal: [1, 2, 3, 5, 8] -> "1-3, 5, 8")
 */
export function formatPageNumbers(pages: number[]): string {
  if (!pages || pages.length === 0) return '';
  const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);

  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);

  return ranges.join(', ');
}

/**
 * Menganalisis file PDF dan merender thumbnail seluruh halaman
 */
export async function inspectPdfForExtractPages(
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<InspectExtractPagesResult> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages: ExtractPageThumbnail[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    onProgress?.(pageNum, pageCount);
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    const thumbScale = Math.min(1.0, 320 / Math.max(viewport.width, viewport.height));
    const thumbViewport = page.getViewport({ scale: thumbScale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(thumbViewport.width));
    canvas.height = Math.max(1, Math.round(thumbViewport.height));
    const ctx = canvas.getContext('2d');

    let thumbnailUrl = '';
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvas,
        canvasContext: ctx,
        viewport: thumbViewport,
      }).promise;

      thumbnailUrl = await new Promise<string>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve('');
          }
        }, 'image/jpeg', 0.85);
      });
    }

    pages.push({
      pageNum,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      aspectRatio: viewport.width / viewport.height,
      thumbnailUrl,
    });
  }

  return {
    file,
    fileName: file.name,
    fileSize: file.size,
    pageCount,
    pages,
  };
}

/**
 * Eksekusi ekstraksi halaman (digabungkan jadi 1 PDF atau diekstrak per lembar ke dalam ZIP)
 */
export async function executeExtractPages(
  file: File,
  options: ExtractPagesOptions,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<GeneratedExtractPagesResult> {
  const sortedPages = Array.from(options.selectedPages).sort((a, b) => a - b);

  if (sortedPages.length === 0) {
    throw new Error('Pilih setidaknya 1 halaman yang ingin diekstrak.');
  }

  onProgress?.(1, 4, 'Membaca dan memuat struktur dokumen PDF asli...');
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  // Validasi batas halaman
  const validPages = sortedPages.filter((p) => p >= 1 && p <= totalPages);
  if (validPages.length === 0) {
    throw new Error('Halaman yang dipilih berada di luar rentang halaman dokumen.');
  }

  const baseName = stripPdfExtension(options.outputName || file.name);

  // =========================================================================
  // KASUS A: MODE 1 — GABUNGKAN SEMUA HALAMAN TERPILIH JADI 1 FILE PDF BARU
  // =========================================================================
  if (options.mode === 'merged') {
    onProgress?.(2, 4, `Menyalin ${validPages.length} halaman terpilih ke dalam dokumen baru...`);

    const newDoc = await PDFDocument.create();
    const zeroBasedIndices = validPages.map((p) => p - 1);
    const copiedPages = await newDoc.copyPages(srcDoc, zeroBasedIndices);

    copiedPages.forEach((page) => {
      newDoc.addPage(page);
    });

    onProgress?.(3, 4, 'Menyalin informasi metadata dokumen...');
    const title = srcDoc.getTitle();
    const author = srcDoc.getAuthor();
    if (title) newDoc.setTitle(title);
    if (author) newDoc.setAuthor(author);
    newDoc.setProducer('Deyafa Arsetya ScorpioPDF Page Extraction Engine');
    newDoc.setCreator('ScorpioPDF (https://scorpio-pdf.local)');
    newDoc.setModificationDate(new Date());

    onProgress?.(4, 4, 'Menyusun berkas PDF hasil ekstraksi...');
    const pdfBytes = await newDoc.save({ useObjectStreams: true });
    const copy = new Uint8Array(pdfBytes.byteLength);
    copy.set(pdfBytes);
    const pdfBlob = new Blob([copy.buffer], { type: 'application/pdf' });

    const finalName = sanitizePdfFilename(
      options.outputName ? options.outputName : `${baseName}-terekstrak`
    );

    return {
      blob: pdfBlob,
      fileName: finalName,
      sizeBytes: pdfBlob.size,
      originalPageCount: totalPages,
      extractedPageCount: validPages.length,
      mode: 'merged',
      extractedPagesList: validPages,
      isZip: false,
      subFilesCount: 1,
    };
  }

  // =========================================================================
  // KASUS B: MODE 2 — EKSTRAK TIAP HALAMAN TERPISAH (JIKA > 1 BUNDEL ZIP)
  // =========================================================================
  onProgress?.(2, 4, `Membuat ${validPages.length} dokumen PDF terpisah...`);

  // Jika hanya 1 halaman yang dipilih, langsung berikan 1 PDF
  if (validPages.length === 1) {
    const singlePageNum = validPages[0];
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(srcDoc, [singlePageNum - 1]);
    newDoc.addPage(copiedPage);

    const pdfBytes = await newDoc.save({ useObjectStreams: true });
    const copy = new Uint8Array(pdfBytes.byteLength);
    copy.set(pdfBytes);
    const pdfBlob = new Blob([copy.buffer], { type: 'application/pdf' });

    const finalName = sanitizePdfFilename(
      options.outputName ? options.outputName : `${baseName}-halaman-${singlePageNum}`
    );

    return {
      blob: pdfBlob,
      fileName: finalName,
      sizeBytes: pdfBlob.size,
      originalPageCount: totalPages,
      extractedPageCount: 1,
      mode: 'separate',
      extractedPagesList: validPages,
      isZip: false,
      subFilesCount: 1,
    };
  }

  // Jika lebih dari 1 halaman, buat arsip ZIP berisi tiap lembar PDF
  const zip = new JSZip();

  for (let i = 0; i < validPages.length; i++) {
    const pageNum = validPages[i];
    onProgress?.(
      2,
      4,
      `Memproses halaman ${pageNum} (${i + 1} dari ${validPages.length})...`
    );

    const singleDoc = await PDFDocument.create();
    const [copied] = await singleDoc.copyPages(srcDoc, [pageNum - 1]);
    singleDoc.addPage(copied);

    const bytes = await singleDoc.save({ useObjectStreams: true });
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);

    const subFileName = `${baseName}-halaman-${pageNum}.pdf`;
    zip.file(subFileName, copy);
  }

  onProgress?.(3, 4, 'Mengompres seluruh berkas PDF ke dalam arsip ZIP...');

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.(
        3,
        4,
        `Mengompres arsip ZIP: ${Math.round(metadata.percent)}%`
      );
    }
  );

  onProgress?.(4, 4, 'Finalisasi arsip ZIP siap unduh...');

  const finalZipName = sanitizeZipFilename(
    options.outputName ? options.outputName : `${baseName}-halaman-terpisah`
  );

  return {
    blob: zipBlob,
    fileName: finalZipName,
    sizeBytes: zipBlob.size,
    originalPageCount: totalPages,
    extractedPageCount: validPages.length,
    mode: 'separate',
    extractedPagesList: validPages,
    isZip: true,
    subFilesCount: validPages.length,
  };
}
