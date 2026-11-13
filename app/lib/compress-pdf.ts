import { PDFDocument } from 'pdf-lib';

export type CompressionLevel = 'extreme' | 'recommended' | 'light' | 'custom';

export interface CompressionPreset {
  id: CompressionLevel;
  name: string;
  badge: string;
  description: string;
  dpiScale: number; // Skala render canvas (1.0 = ~72-96 dpi, 1.33 = ~120-130 dpi, 1.8 = ~150-180 dpi, 2.2 = ~200+ dpi)
  jpegQuality: number; // 0.1 s.d. 1.0
  estimatedReduction: string;
  accentColor: string;
}

export const COMPRESSION_PRESETS: Record<CompressionLevel, CompressionPreset> = {
  extreme: {
    id: 'extreme',
    name: 'Kompresi Ekstrem',
    badge: 'Terkecil',
    description: 'Ukuran file sekecil mungkin. Ideal untuk batas upload ketat CPNS, BUMN, atau email (max 200–500 KB).',
    dpiScale: 1.1,
    jpegQuality: 0.52,
    estimatedReduction: '~65% – 85%',
    accentColor: '#E11D48',
  },
  recommended: {
    id: 'recommended',
    name: 'Kompresi Direkomendasikan',
    badge: 'Keseimbangan Terbaik',
    description: 'Keseimbangan optimal antara penghematan ukuran file dan ketajaman teks/visual dokumen.',
    dpiScale: 1.45,
    jpegQuality: 0.72,
    estimatedReduction: '~40% – 65%',
    accentColor: '#059669',
  },
  light: {
    id: 'light',
    name: 'Kompresi Ringan',
    badge: 'Kualitas Tinggi',
    description: 'Pengurangan ukuran moderat dengan kualitas visual maksimal, sangat jernih untuk dicetak atau presentasi.',
    dpiScale: 1.9,
    jpegQuality: 0.88,
    estimatedReduction: '~20% – 40%',
    accentColor: '#2563EB',
  },
  custom: {
    id: 'custom',
    name: 'Kustom Target Ukuran',
    badge: 'Fleksibel',
    description: 'Atur kualitas kompresi secara manual sesuai batas ukuran target yang Anda inginkan.',
    dpiScale: 1.35,
    jpegQuality: 0.65,
    estimatedReduction: 'Disesuaikan',
    accentColor: '#7C3AED',
  },
};

export interface CompressPdfOptions {
  level: CompressionLevel;
  customQuality?: number; // 0.2 s.d. 0.95
  grayscale: boolean; // Konversi ke hitam putih / abu-abu
  removeMetadata: boolean; // Bersihkan metadata dokumen
  outputName?: string;
}

export interface CompressPageThumbnail {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  thumbnailUrl: string;
}

export interface InspectCompressPdfResult {
  file: File;
  name: string;
  size: number;
  pageCount: number;
  pages: CompressPageThumbnail[];
}

export interface GeneratedCompressResult {
  blob: Blob;
  fileName: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savedBytes: number;
  reductionPercentage: number;
  pageCount: number;
}

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('Kompres PDF hanya dapat dijalankan di lingkungan browser.');
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

export function sanitizePdfFilename(name: string, fallback = 'dokumen-terkompresi'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Menganalisis file PDF dan merender thumbnail seluruh halaman
 */
export async function inspectPdfForCompress(
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<InspectCompressPdfResult> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages: CompressPageThumbnail[] = [];

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
        }, 'image/jpeg', 0.82);
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
 * Eksekusi Kompresi Dokumen PDF di Browser
 */
export async function executeCompressPdf(
  inspectData: InspectCompressPdfResult,
  options: CompressPdfOptions,
  onProgress?: (current: number, total: number) => void
): Promise<GeneratedCompressResult> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await inspectData.file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const srcPdfDoc = await loadingTask.promise;
  const pageCount = srcPdfDoc.numPages;

  const preset = COMPRESSION_PRESETS[options.level] || COMPRESSION_PRESETS.recommended;
  const dpiScale = preset.dpiScale;
  const quality =
    options.level === 'custom' && options.customQuality
      ? options.customQuality
      : preset.jpegQuality;

  const newDoc = await PDFDocument.create();

  if (options.removeMetadata) {
    newDoc.setTitle('');
    newDoc.setAuthor('');
    newDoc.setSubject('');
    newDoc.setKeywords([]);
    newDoc.setProducer('Deyafa Arsetya ScorpioPDF Compressor');
    newDoc.setCreator('ScorpioPDF Engine');
  }

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    onProgress?.(pageNum, pageCount);
    const page = await srcPdfDoc.getPage(pageNum);
    const origViewport = page.getViewport({ scale: 1.0 });

    // Render halaman ke canvas dengan DPI yang dioptimalkan
    const renderViewport = page.getViewport({ scale: dpiScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(renderViewport.width));
    canvas.height = Math.max(1, Math.round(renderViewport.height));
    const ctx = canvas.getContext('2d', { willReadFrequently: options.grayscale });

    if (!ctx) {
      throw new Error('Gagal menyiapkan context grafis kanvas kompresi.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport: renderViewport,
    }).promise;

    // Terapkan Konversi Skala Abu-abu (Grayscale) jika dipilih pengguna
    if (options.grayscale) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Luminansi ITU-R BT.601
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Ekstrak sebagai JPEG terkompresi
    const jpegBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });

    if (!jpegBlob) {
      throw new Error(`Gagal mengompresi halaman ${pageNum}`);
    }

    const jpegBuffer = await jpegBlob.arrayBuffer();
    const embeddedImg = await newDoc.embedJpg(jpegBuffer);

    const newPage = newDoc.addPage([origViewport.width, origViewport.height]);
    newPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: origViewport.width,
      height: origViewport.height,
    });
  }

  const pdfBytes = await newDoc.save({ useObjectStreams: true });
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const resultBlob = new Blob([copy.buffer], { type: 'application/pdf' });

  const originalSize = inspectData.size;
  const compressedSize = resultBlob.size;
  const saved = Math.max(0, originalSize - compressedSize);
  const reductionPercent =
    originalSize > 0 ? Math.round((saved / originalSize) * 100) : 0;

  const baseName =
    options.outputName?.trim() ||
    `${stripPdfExtension(inspectData.name)}-terkompresi`;

  return {
    blob: resultBlob,
    fileName: sanitizePdfFilename(baseName, 'dokumen-terkompresi'),
    originalSizeBytes: originalSize,
    compressedSizeBytes: compressedSize,
    savedBytes: saved,
    reductionPercentage: reductionPercent,
    pageCount,
  };
}

