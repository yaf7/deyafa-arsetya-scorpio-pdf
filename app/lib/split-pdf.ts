import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

export type SplitMode = 'range' | 'extract' | 'fixed';

export interface SplitRangeItem {
  id: string;
  name: string;
  fromPage: number;
  toPage: number;
  colorKey: string;
}

export interface RangeColorDef {
  key: string;
  label: string;
  primary: string;
  border: string;
  bgLight: string;
  text: string;
  badgeBg: string;
}

export const RANGE_COLOR_PALETTES: RangeColorDef[] = [
  {
    key: 'emerald',
    label: 'Hijau Zamrud',
    primary: '#059669',
    border: '#10B981',
    bgLight: '#ECFDF5',
    text: '#065F46',
    badgeBg: '#D1FAE5',
  },
  {
    key: 'blue',
    label: 'Biru Samudra',
    primary: '#2563EB',
    border: '#3B82F6',
    bgLight: '#EFF6FF',
    text: '#1E40AF',
    badgeBg: '#DBEAFE',
  },
  {
    key: 'purple',
    label: 'Ungu Lavender',
    primary: '#7C3AED',
    border: '#8B5CF6',
    bgLight: '#F5F3FF',
    text: '#5B21B6',
    badgeBg: '#EDE9FE',
  },
  {
    key: 'amber',
    label: 'Kuning Amber',
    primary: '#D97706',
    border: '#F59E0B',
    bgLight: '#FFFBEB',
    text: '#92400E',
    badgeBg: '#FEF3C7',
  },
  {
    key: 'rose',
    label: 'Merah Rose',
    primary: '#E11D48',
    border: '#F43F5E',
    bgLight: '#FFF1F2',
    text: '#9F1239',
    badgeBg: '#FFE4E6',
  },
  {
    key: 'cyan',
    label: 'Biru Cyan',
    primary: '#0891B2',
    border: '#06B6D4',
    bgLight: '#ECFEFF',
    text: '#155E75',
    badgeBg: '#CFFAFE',
  },
  {
    key: 'indigo',
    label: 'Nila Indigo',
    primary: '#4F46E5',
    border: '#6366F1',
    bgLight: '#EEF2FF',
    text: '#3730A3',
    badgeBg: '#E0E7FF',
  },
  {
    key: 'orange',
    label: 'Jingga Cerah',
    primary: '#EA580C',
    border: '#F97316',
    bgLight: '#FFF7ED',
    text: '#9A3412',
    badgeBg: '#FFEDD5',
  },
];

export function getRangeColor(index: number): RangeColorDef {
  return RANGE_COLOR_PALETTES[index % RANGE_COLOR_PALETTES.length];
}

export function getColorByKey(key: string): RangeColorDef {
  const found = RANGE_COLOR_PALETTES.find((c) => c.key === key);
  return found || RANGE_COLOR_PALETTES[0];
}

export interface SplitPdfPageInfo {
  pageNumber: number; // 1-indexed
  widthPt: number;
  heightPt: number;
  thumbnailUrl: string;
}

export interface InspectSplitPdfResult {
  file: File;
  name: string;
  size: number;
  pageCount: number;
  pages: SplitPdfPageInfo[];
}

export interface SplitPdfOptions {
  mode: SplitMode;
  // Opsi Mode 1: Pisah Berdasarkan Rentang Kustom
  ranges: SplitRangeItem[];
  mergeRangesIntoOne: boolean;
  // Opsi Mode 2: Ekstrak Halaman Tertentu
  selectedPages: number[]; // 1-indexed
  mergeExtractedIntoOne: boolean;
  // Opsi Mode 3: Pisah Setiap N Halaman
  fixedPagesPerSplit: number;
  // Nama output
  outputBaseName?: string;
}

export interface OutputFileInfo {
  fileName: string;
  pageCount: number;
  pageLabel: string;
  sizeBytes: number;
  blob: Blob;
  downloadUrl?: string;
}

export interface GeneratedSplitResult {
  isZip: boolean;
  primaryBlob: Blob;
  primaryFileName: string;
  totalFiles: number;
  totalPages: number;
  outputFiles: OutputFileInfo[];
}

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('Pisah PDF hanya dapat dijalankan di lingkungan browser.');
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

export function sanitizePdfFilename(name: string, fallback = 'dokumen-pisah'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Parsing teks daftar halaman (misal: "1-3, 5, 8-10") menjadi daftar angka halaman 1-indexed
 */
export function parsePageSelectionStringToNumbers(
  rangeStr: string,
  totalPages: number
): number[] {
  if (!rangeStr || !rangeStr.trim()) {
    return [];
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
          result.add(p);
        }
      }
    } else {
      const pageNum = parseInt(trimmed, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        result.add(pageNum);
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}

/**
 * Membaca dan merender thumbnail seluruh halaman PDF untuk pratinjau live WYSIWYG
 */
export async function inspectPdfForSplit(
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<InspectSplitPdfResult> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages: SplitPdfPageInfo[] = [];

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
      pageNumber: pageNum,
      widthPt: Math.round(viewport.width),
      heightPt: Math.round(viewport.height),
      thumbnailUrl,
    });
  }

  return {
    file,
    name: file.name,
    size: file.size,
    pageCount,
    pages,
  };
}

/**
 * Eksekusi Pemisahan PDF Berdasarkan Mode dan Opsi yang Dipilih
 */
export async function executeSplitPdf(
  inspectData: InspectSplitPdfResult,
  options: SplitPdfOptions,
  onProgress?: (current: number, total: number) => void
): Promise<GeneratedSplitResult> {
  const { file, name, pageCount } = inspectData;
  const arrayBuffer = await file.arrayBuffer();

  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const baseName = stripPdfExtension(options.outputBaseName?.trim() || name);

  // Buat grup halaman yang akan diekstrak
  interface FileGroup {
    fileName: string;
    pageLabel: string;
    pageIndices: number[]; // 0-indexed
  }

  const groups: FileGroup[] = [];

  if (options.mode === 'range') {
    // Mode 1: Pisah Berdasarkan Rentang Halaman
    if (options.mergeRangesIntoOne) {
      // Gabungkan semua rentang ke dalam 1 file tunggal
      const combinedIndices: number[] = [];
      const labels: string[] = [];

      options.ranges.forEach((rng, rIdx) => {
        const minP = Math.max(1, Math.min(rng.fromPage, rng.toPage));
        const maxP = Math.min(pageCount, Math.max(rng.fromPage, rng.toPage));
        for (let p = minP; p <= maxP; p++) {
          combinedIndices.push(p - 1);
        }
        labels.push(`${minP}-${maxP}`);
      });

      if (combinedIndices.length > 0) {
        groups.push({
          fileName: `${baseName}-rentang-terpilih.pdf`,
          pageLabel: `Halaman ${labels.join(', ')}`,
          pageIndices: combinedIndices,
        });
      }
    } else {
      // Ekspor masing-masing rentang sebagai file terpisah
      options.ranges.forEach((rng, rIdx) => {
        const minP = Math.max(1, Math.min(rng.fromPage, rng.toPage));
        const maxP = Math.min(pageCount, Math.max(rng.fromPage, rng.toPage));
        const indices: number[] = [];
        for (let p = minP; p <= maxP; p++) {
          indices.push(p - 1);
        }

        if (indices.length > 0) {
          const rangeName = rng.name.trim() || `Bagian-${rIdx + 1}`;
          const cleanRangeName = rangeName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
          groups.push({
            fileName: `${baseName}-${cleanRangeName}-hal-${minP}-${maxP}.pdf`,
            pageLabel: `Halaman ${minP}–${maxP}`,
            pageIndices: indices,
          });
        }
      });
    }
  } else if (options.mode === 'extract') {
    // Mode 2: Ekstrak Halaman Tertentu
    const validPages = options.selectedPages
      .filter((p) => p >= 1 && p <= pageCount)
      .sort((a, b) => a - b);

    if (validPages.length === 0) {
      throw new Error('Pilih minimal 1 halaman untuk diekstrak.');
    }

    if (options.mergeExtractedIntoOne) {
      // Gabungkan semua halaman terpilih jadi 1 file
      groups.push({
        fileName: `${baseName}-halaman-terpilih.pdf`,
        pageLabel: `Halaman ${validPages.join(', ')}`,
        pageIndices: validPages.map((p) => p - 1),
      });
    } else {
      // Pisah tiap halaman terpilih jadi 1 file terpisah
      validPages.forEach((p) => {
        groups.push({
          fileName: `${baseName}-halaman-${p}.pdf`,
          pageLabel: `Halaman ${p}`,
          pageIndices: [p - 1],
        });
      });
    }
  } else if (options.mode === 'fixed') {
    // Mode 3: Pisah Setiap N Halaman
    const n = Math.max(1, Math.min(pageCount, options.fixedPagesPerSplit));
    let chunkIndex = 1;

    for (let start = 1; start <= pageCount; start += n) {
      const end = Math.min(pageCount, start + n - 1);
      const indices: number[] = [];
      for (let p = start; p <= end; p++) {
        indices.push(p - 1);
      }

      groups.push({
        fileName: `${baseName}-bagian-${chunkIndex}-hal-${start}-${end}.pdf`,
        pageLabel: start === end ? `Halaman ${start}` : `Halaman ${start}–${end}`,
        pageIndices: indices,
      });
      chunkIndex++;
    }
  }

  if (groups.length === 0) {
    throw new Error('Tidak ada halaman atau rentang yang valid untuk diekstrak.');
  }

  const outputFiles: OutputFileInfo[] = [];
  let totalProcessedPages = 0;

  for (let gIdx = 0; gIdx < groups.length; gIdx++) {
    const grp = groups[gIdx];
    onProgress?.(gIdx + 1, groups.length);

    const subDoc = await PDFDocument.create();
    const copiedPages = await subDoc.copyPages(srcDoc, grp.pageIndices);

    for (const page of copiedPages) {
      subDoc.addPage(page);
    }

    const pdfBytes = await subDoc.save();
    const copy = new Uint8Array(pdfBytes.byteLength);
    copy.set(pdfBytes);
    const pdfBlob = new Blob([copy.buffer], { type: 'application/pdf' });

    outputFiles.push({
      fileName: sanitizePdfFilename(grp.fileName),
      pageCount: grp.pageIndices.length,
      pageLabel: grp.pageLabel,
      sizeBytes: pdfBlob.size,
      blob: pdfBlob,
    });

    totalProcessedPages += grp.pageIndices.length;
  }

  // Jika hanya 1 file PDF dihasilkan, kembalikan langsung PDF tersebut
  if (outputFiles.length === 1) {
    const single = outputFiles[0];
    return {
      isZip: false,
      primaryBlob: single.blob,
      primaryFileName: single.fileName,
      totalFiles: 1,
      totalPages: single.pageCount,
      outputFiles,
    };
  }

  // Jika lebih dari 1 file dihasilkan, bungkus ke dalam arsip ZIP
  const zip = new JSZip();
  const folder = zip.folder(baseName) || zip;

  for (const item of outputFiles) {
    folder.file(item.fileName, item.blob);
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      // Progress zip
    }
  );

  const zipFileName = `${baseName}-terpisah.zip`;

  return {
    isZip: true,
    primaryBlob: zipBlob,
    primaryFileName: zipFileName,
    totalFiles: outputFiles.length,
    totalPages: totalProcessedPages,
    outputFiles,
  };
}

