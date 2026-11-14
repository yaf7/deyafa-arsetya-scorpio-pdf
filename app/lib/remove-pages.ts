import { PDFDocument } from 'pdf-lib';

export interface RemovePageThumbnail {
  pageNum: number; // 1-indexed
  width: number;
  height: number;
  aspectRatio: number;
  thumbnailUrl: string;
}

export interface InspectRemovePagesResult {
  file: File;
  fileName: string;
  fileSize: number;
  pageCount: number;
  pages: RemovePageThumbnail[];
}

export interface GeneratedRemovePagesResult {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  originalPageCount: number;
  removedPageCount: number;
  remainingPageCount: number;
  removedPagesList: number[];
  remainingPagesList: number[];
}

// Inisialisasi pdfjs-dist secara aman di lingkungan browser
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('Hapus Halaman PDF hanya dapat dijalankan di browser.');
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

export function sanitizePdfFilename(name: string, fallback = 'dokumen-bersih'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Parsing teks rentang halaman (misal: "1, 3-5, 8, 11-14") menjadi Set nomor halaman 1-indexed
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
 * Format kumpulan nomor halaman menjadi teks ringkas rentang (misal: [1, 2, 3, 5, 7, 8] -> "1-3, 5, 7-8")
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
export async function inspectPdfForRemovePages(
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<InspectRemovePagesResult> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages: RemovePageThumbnail[] = [];

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
 * Eksekusi penghapusan halaman dari berkas PDF dan menyusun berkas PDF baru
 */
export async function executeRemovePages(
  file: File,
  pagesToRemove: Set<number>,
  outputName?: string,
  onProgress?: (step: number, total: number, message: string) => void
): Promise<GeneratedRemovePagesResult> {
  onProgress?.(1, 4, 'Membaca struktur dokumen PDF asli...');
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

  const totalPages = srcDoc.getPageCount();
  const allPageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Filter halaman yang akan dipertahankan
  const remainingPageNumbers = allPageNumbers.filter((p) => !pagesToRemove.has(p));
  const removedPageNumbers = allPageNumbers.filter((p) => pagesToRemove.has(p));

  if (remainingPageNumbers.length === 0) {
    throw new Error('Anda tidak dapat menghapus semua halaman. Sisakan setidaknya 1 halaman dalam dokumen PDF.');
  }

  if (removedPageNumbers.length === 0) {
    throw new Error('Pilih setidaknya 1 halaman yang ingin dihapus dari dokumen.');
  }

  onProgress?.(2, 4, `Menyusun kembali ${remainingPageNumbers.length} halaman terpilih...`);

  // Buat PDF baru yang hanya memuat halaman yang dipertahankan
  const newDoc = await PDFDocument.create();

  // Konversi nomor halaman 1-indexed ke indeks 0-indexed untuk pdf-lib
  const zeroBasedIndicesToCopy = remainingPageNumbers.map((p) => p - 1);
  const copiedPages = await newDoc.copyPages(srcDoc, zeroBasedIndicesToCopy);

  copiedPages.forEach((page) => {
    newDoc.addPage(page);
  });

  onProgress?.(3, 4, 'Menyalin metadata dokumen dan mengoptimalkan struktur...');

  // Pertahankan judul dan penulis jika ada
  const title = srcDoc.getTitle();
  const author = srcDoc.getAuthor();
  if (title) newDoc.setTitle(title);
  if (author) newDoc.setAuthor(author);
  newDoc.setProducer('Deyafa Arsetya ScorpioPDF Page Engine');
  newDoc.setCreator('ScorpioPDF (https://scorpio-pdf.local)');
  newDoc.setModificationDate(new Date());

  onProgress?.(4, 4, 'Menyimpan berkas PDF baru...');

  const pdfBytes = await newDoc.save({ useObjectStreams: true });
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const resultBlob = new Blob([copy.buffer], { type: 'application/pdf' });

  const finalName = sanitizePdfFilename(
    outputName ? outputName : `${stripPdfExtension(file.name)}-bersih`
  );

  return {
    blob: resultBlob,
    fileName: finalName,
    sizeBytes: resultBlob.size,
    originalPageCount: totalPages,
    removedPageCount: removedPageNumbers.length,
    remainingPageCount: remainingPageNumbers.length,
    removedPagesList: removedPageNumbers,
    remainingPagesList: remainingPageNumbers,
  };
}
