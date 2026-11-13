import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export type MergeStandardPageSize = 'original' | 'a4' | 'f4' | 'letter';

export const MERGE_PAGE_SIZES: Record<
  MergeStandardPageSize,
  { label: string; widthPt: number; heightPt: number; desc: string }
> = {
  original: {
    label: 'Pertahankan Ukuran Asli Tiap File (Rekomendasi)',
    widthPt: 0,
    heightPt: 0,
    desc: 'Mempertahankan ukuran asli masing-masing halaman PDF tanpa pemotongan skala',
  },
  a4: {
    label: 'Seragamkan ke A4 (210 × 297 mm)',
    widthPt: 595.28,
    heightPt: 841.89,
    desc: 'Standar dokumen resmi Indonesia dan internasional',
  },
  f4: {
    label: 'Seragamkan ke F4 / Folio (215 × 330 mm)',
    widthPt: 609.45,
    heightPt: 935.43,
    desc: 'Standar kertas kedinasan, perkantoran, dan hukum di Indonesia',
  },
  letter: {
    label: 'Seragamkan ke US Letter (216 × 279 mm)',
    widthPt: 612.0,
    heightPt: 792.0,
    desc: 'Standar format dokumen Amerika Serikat',
  },
};

export type MergeOrientation = 'keep' | 'portrait' | 'landscape';

export const MERGE_ORIENTATIONS: Record<
  MergeOrientation,
  { label: string; desc: string }
> = {
  keep: {
    label: 'Sesuai Orientasi Tiap Halaman',
    desc: 'Mempertahankan posisi tegak atau mendatar asli tiap file PDF',
  },
  portrait: {
    label: 'Seragamkan Tegak (Portrait)',
    desc: 'Memastikan semua halaman dalam posisi vertikal siap cetak',
  },
  landscape: {
    label: 'Seragamkan Mendatar (Landscape)',
    desc: 'Memastikan semua halaman dalam posisi horizontal lebar',
  },
};

export type MergePageNumbering = 'none' | 'bottom-center' | 'bottom-right' | 'top-right';

export const MERGE_PAGE_NUMBERINGS: Record<
  MergePageNumbering,
  { label: string; tag: string; desc: string }
> = {
  none: {
    label: 'Tanpa Nomor Halaman',
    tag: 'Asli',
    desc: 'Tidak menambahkan teks penomoran baru pada dokumen gabungan',
  },
  'bottom-center': {
    label: 'Bawah Tengah (1 dari N)',
    tag: 'Populer',
    desc: 'Menempatkan nomor halaman di margin bawah tengah dokumen',
  },
  'bottom-right': {
    label: 'Bawah Kanan',
    tag: 'Klasik',
    desc: 'Menempatkan nomor halaman di sudut kanan bawah setiap lembar',
  },
  'top-right': {
    label: 'Atas Kanan',
    tag: 'Header',
    desc: 'Menempatkan nomor halaman di sudut kanan atas dokumen',
  },
};

export interface ManagedMergePdfItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  thumbnailUrl: string;
  widthPt: number;
  heightPt: number;
  rotation: number; // 0, 90, 180, 270
  pageRangeMode: 'all' | 'custom';
  customPageRange: string; // misal "1-3, 5, 8"
  activePagesCount: number;
}

export interface MergePdfOptions {
  standardPageSize: MergeStandardPageSize;
  orientation: MergeOrientation;
  pageNumbering: MergePageNumbering;
  addBlankSeparator: boolean;
  outputName?: string;
}

export interface GeneratedMergeResult {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  totalMergedFiles: number;
  totalMergedPages: number;
}

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('Gabung PDF hanya dapat dijalankan di browser.');
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
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function stripPdfExtension(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '');
}

export function sanitizePdfFilename(name: string, fallback = 'dokumen-gabungan'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Parsing teks rentang halaman (misal: "1-3, 5, 8-10") menjadi daftar index 0-indexed yang valid
 */
export function parsePageRangeToIndices(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr || !rangeStr.trim()) {
    // Default seluruh halaman
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const result = new Set<number>();
  const parts = rangeStr.split(/[,;\s]+/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let p = min; p <= max; p++) {
          result.add(p - 1);
        }
      }
    } else {
      const pageNum = parseInt(trimmed, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        result.add(pageNum - 1);
      }
    }
  }

  const sorted = Array.from(result).sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : Array.from({ length: totalPages }, (_, i) => i);
}

/**
 * Membaca metadata file PDF dan membuat thumbnail halaman 1
 */
export async function inspectPdfForMerge(file: File): Promise<ManagedMergePdfItem> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;

  // Baca halaman 1 untuk thumbnail
  const page1 = await pdfDoc.getPage(1);
  const viewport = page1.getViewport({ scale: 1.0 });

  const thumbScale = Math.min(1.2, 380 / viewport.width);
  const thumbViewport = page1.getViewport({ scale: thumbScale });
  const canvas = document.createElement('canvas');
  canvas.width = thumbViewport.width;
  canvas.height = thumbViewport.height;
  const ctx = canvas.getContext('2d');

  let thumbnailUrl = '';
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page1.render({
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

  return {
    id: `merge-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    name: file.name,
    size: file.size,
    pageCount,
    thumbnailUrl,
    widthPt: Math.round(viewport.width),
    heightPt: Math.round(viewport.height),
    rotation: 0,
    pageRangeMode: 'all',
    customPageRange: '',
    activePagesCount: pageCount,
  };
}

/**
 * Menggabungkan banyak dokumen PDF menjadi 1 file PDF utuh dengan opsi kustom
 */
export async function executeMergePdf(
  items: ManagedMergePdfItem[],
  options: MergePdfOptions,
  onProgress?: (current: number, total: number) => void
): Promise<GeneratedMergeResult> {
  if (!items || items.length < 2) {
    throw new Error('Pilih minimal 2 file PDF untuk digabungkan.');
  }

  const mergedDoc = await PDFDocument.create();
  let totalProcessedPages = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    onProgress?.(idx + 1, items.length);

    const arrayBuffer = await item.file.arrayBuffer();
    let srcDoc: PDFDocument;
    try {
      srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    } catch (err) {
      throw new Error(`Gagal membuka file "${item.name}": Pastikan file tidak rusak atau terkunci password.`);
    }

    const totalPagesInDoc = srcDoc.getPageCount();
    const indicesToCopy =
      item.pageRangeMode === 'custom' && item.customPageRange.trim()
        ? parsePageRangeToIndices(item.customPageRange, totalPagesInDoc)
        : Array.from({ length: totalPagesInDoc }, (_, i) => i);

    if (indicesToCopy.length === 0) continue;

    const copiedPages = await mergedDoc.copyPages(srcDoc, indicesToCopy);

    for (const page of copiedPages) {
      // 1. Terapkan Rotasi Kustom Jika Ada
      if (item.rotation) {
        const currentAngle = page.getRotation().angle;
        page.setRotation(degrees((currentAngle + item.rotation) % 360));
      }

      // 2. Terapkan Penyeragaman Orientasi Jika Dipilih
      if (options.orientation === 'portrait') {
        const { width, height } = page.getSize();
        if (width > height) {
          // Putar 90 derajat agar menjadi potret
          const cur = page.getRotation().angle;
          page.setRotation(degrees((cur + 90) % 360));
        }
      } else if (options.orientation === 'landscape') {
        const { width, height } = page.getSize();
        if (height > width) {
          // Putar 90 derajat agar menjadi lanskap
          const cur = page.getRotation().angle;
          page.setRotation(degrees((cur + 90) % 360));
        }
      }

      // 3. Terapkan Penyeragaman Ukuran Kertas Jika Dipilih
      if (options.standardPageSize !== 'original') {
        const targetConfig = MERGE_PAGE_SIZES[options.standardPageSize];
        if (targetConfig && targetConfig.widthPt > 0) {
          const { width, height } = page.getSize();
          const isLandscape = width > height;

          const targetW = isLandscape ? targetConfig.heightPt : targetConfig.widthPt;
          const targetH = isLandscape ? targetConfig.widthPt : targetConfig.heightPt;

          page.setSize(targetW, targetH);
        }
      }

      mergedDoc.addPage(page);
      totalProcessedPages++;
    }

    // 4. Tambahkan Lembar Pemisah Kosong Jika Opsi Aktif dan Bukan File Terakhir
    if (options.addBlankSeparator && idx < items.length - 1) {
      const lastPage = mergedDoc.getPage(mergedDoc.getPageCount() - 1);
      const { width, height } = lastPage.getSize();
      const blankPage = mergedDoc.addPage([width, height]);
      blankPage.setRotation(degrees(lastPage.getRotation().angle));
      totalProcessedPages++;
    }
  }

  // 5. Tambahkan Penomoran Halaman Baru Jika Diaktifkan
  if (options.pageNumbering !== 'none') {
    const font = await mergedDoc.embedFont(StandardFonts.Helvetica);
    const totalPages = mergedDoc.getPageCount();

    for (let i = 0; i < totalPages; i++) {
      const page = mergedDoc.getPage(i);
      const { width, height } = page.getSize();
      const pageNumText = `${i + 1} dari ${totalPages}`;
      const fontSize = 9.5;
      const textWidth = font.widthOfTextAtSize(pageNumText, fontSize);

      let xPos = (width - textWidth) / 2;
      let yPos = 24;

      if (options.pageNumbering === 'bottom-right') {
        xPos = width - textWidth - 36;
        yPos = 24;
      } else if (options.pageNumbering === 'top-right') {
        xPos = width - textWidth - 36;
        yPos = height - 30;
      }

      page.drawText(pageNumText, {
        x: xPos,
        y: yPos,
        size: fontSize,
        font,
        color: rgb(0.35, 0.42, 0.52), // Slate 600
      });
    }
  }

  const pdfBytes = await mergedDoc.save();

  // Bersihkan Uint8Array menjadi Blob kompatibel
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });

  const baseName =
    options.outputName?.trim() ||
    `ScorpioPDF-Gabungan-${items.length}-Dokumen`;

  const finalFileName = sanitizePdfFilename(baseName, 'dokumen-gabungan');

  return {
    blob,
    fileName: finalFileName,
    sizeBytes: blob.size,
    totalMergedFiles: items.length,
    totalMergedPages: totalProcessedPages,
  };
}

