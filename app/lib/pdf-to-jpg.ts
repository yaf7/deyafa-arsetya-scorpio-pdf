import JSZip from 'jszip';

export type ExportImageFormat = 'jpg' | 'jpeg' | 'png';

export type DpiOption = '72' | '96' | '150' | '300';

export const DPI_CONFIG: Record<
  DpiOption,
  { label: string; scale: number; desc: string }
> = {
  '72': { label: '72 DPI', scale: 1.0, desc: 'Ukuran layar standar (1x)' },
  '96': { label: '96 DPI', scale: 1.333, desc: 'Standar web & hemat ukuran (1.3x)' },
  '150': {
    label: '150 DPI',
    scale: 2.083,
    desc: 'Kualitas tinggi & tajam — Rekomendasi (2.1x)',
  },
  '300': {
    label: '300 DPI',
    scale: 4.167,
    desc: 'Ultra HD / Standar cetak profesional (4.2x)',
  },
};

export type QualityPreset = '1.0' | '0.9' | '0.75';

export const QUALITY_PRESETS: Record<
  QualityPreset,
  { label: string; value: number; desc: string }
> = {
  '1.0': { label: 'Maksimal (100%)', value: 1.0, desc: 'Tanpa artefak kompresi' },
  '0.9': {
    label: 'Tinggi (90%)',
    value: 0.9,
    desc: 'Sangat jernih & seimbang (Default)',
  },
  '0.75': {
    label: 'Sedang (75%)',
    value: 0.75,
    desc: 'Ukuran file lebih ringkas',
  },
};

export interface PdfPageSummary {
  pageNumber: number; // 1-indexed
  widthPt: number;
  heightPt: number;
  aspectRatio: number;
  thumbnailUrl?: string;
}

export interface ManagedPdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  pages: PdfPageSummary[];
}

export interface PdfToImageOptions {
  format: ExportImageFormat;
  dpi: DpiOption;
  quality: number; // 0.75 to 1.0
  transparentPng: boolean;
  selectedPages: number[]; // 1-indexed page numbers
  outputName?: string;
}

export interface RenderedImageItem {
  pageNumber: number;
  fileName: string;
  blob: Blob;
  previewUrl: string;
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
}

export interface GeneratedImageResult {
  kind: 'single' | 'zip';
  blob: Blob;
  fileName: string;
  images: RenderedImageItem[];
  format: ExportImageFormat;
  totalCount: number;
}

// Inisialisasi pdfjs-dist secara aman di browser (hanya saat window aktif)
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF to Image hanya dapat dijalankan di browser.');
  }

  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((pdfjs) => {
      // Pastikan worker selalu mengarah ke public/pdf.worker.min.mjs
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

export function sanitizeFilename(name: string, fallback = 'scorpio-pdf'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  return clean || fallback;
}

/**
 * Muat file PDF dan ekstrak metadata seluruh halaman serta thumbnail cepat
 */
export async function inspectPdfDocument(
  file: File,
  onThumbnailReady?: (pageNumber: number, thumbnailUrl: string) => void
): Promise<ManagedPdfFile> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages: PdfPageSummary[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    const summary: PdfPageSummary = {
      pageNumber: pageNum,
      widthPt: Math.round(viewport.width),
      heightPt: Math.round(viewport.height),
      aspectRatio: viewport.width / viewport.height,
    };

    pages.push(summary);

    // Render thumbnail resolusi rendah untuk pratinjau antarmuka yang cepat
    try {
      const thumbScale = Math.min(240 / viewport.width, 320 / viewport.height);
      const thumbViewport = page.getViewport({ scale: thumbScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(thumbViewport.width);
      canvas.height = Math.floor(thumbViewport.height);
      const ctx = canvas.getContext('2d', { alpha: false });

      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvas,
          canvasContext: ctx,
          viewport: thumbViewport,
        }).promise;

        const thumbBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.8)
        );

        if (thumbBlob) {
          const thumbUrl = URL.createObjectURL(thumbBlob);
          summary.thumbnailUrl = thumbUrl;
          onThumbnailReady?.(pageNum, thumbUrl);
        }
      }
    } catch {
      // Jika thumbnail gagal dirender, biarkan placeholder fallback
    }

    // Beri jeda micro-tick agar UI tetap mulus
    await new Promise((r) => setTimeout(r, 0));
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    file,
    name: file.name,
    size: file.size,
    pageCount,
    pages,
  };
}

/**
 * Konversi halaman PDF menjadi gambar beresolusi tinggi sesuai opsi
 */
export async function convertPdfToImages(
  pdfFile: File,
  options: PdfToImageOptions,
  onProgress?: (current: number, total: number, pageNumber: number) => void
): Promise<GeneratedImageResult> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await pdfFile.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  // Filter halaman yang dipilih
  const pagesToRender =
    options.selectedPages.length > 0
      ? options.selectedPages.filter((p) => p >= 1 && p <= totalPages)
      : Array.from({ length: totalPages }, (_, i) => i + 1);

  if (pagesToRender.length === 0) {
    throw new Error('Pilih minimal satu halaman PDF untuk dikonversi.');
  }

  const baseName = stripPdfExtension(
    options.outputName?.trim() || pdfFile.name
  );
  const dpiConfig = DPI_CONFIG[options.dpi] || DPI_CONFIG['150'];
  const ext = options.format === 'jpeg' ? 'jpeg' : options.format === 'png' ? 'png' : 'jpg';
  const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';

  const renderedImages: RenderedImageItem[] = [];

  for (let i = 0; i < pagesToRender.length; i++) {
    const pageNum = pagesToRender[i];
    onProgress?.(i + 1, pagesToRender.length, pageNum);

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: dpiConfig.scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const isTransparentPng = options.format === 'png' && options.transparentPng;
    const ctx = canvas.getContext('2d', { alpha: isTransparentPng });

    if (!ctx) {
      throw new Error('Gagal menginisialisasi kanvas rendering 2D.');
    }

    if (!isTransparentPng) {
      // Isi latar putih agar dokumen PDF tampil solid bersih tanpa artefak hitam
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport: viewport,
    }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Gagal membuat file gambar untuk halaman ${pageNum}`));
        },
        mimeType,
        options.format === 'png' ? undefined : options.quality
      );
    });

    const pageIndexStr = String(pageNum).padStart(
      totalPages >= 100 ? 3 : 2,
      '0'
    );
    const fileName = `${sanitizeFilename(baseName)}-hal-${pageIndexStr}.${ext}`;
    const previewUrl = URL.createObjectURL(blob);

    renderedImages.push({
      pageNumber: pageNum,
      fileName,
      blob,
      previewUrl,
      widthPx: canvas.width,
      heightPx: canvas.height,
      sizeBytes: blob.size,
    });

    // Beri jeda micro-tick
    await new Promise((r) => setTimeout(r, 0));
  }

  // Jika hanya 1 gambar yang dihasilkan, berikan direct single download
  if (renderedImages.length === 1) {
    const single = renderedImages[0];
    return {
      kind: 'single',
      blob: single.blob,
      fileName: single.fileName,
      images: renderedImages,
      format: options.format,
      totalCount: 1,
    };
  }

  // Jika banyak gambar, kemas otomatis ke arsip ZIP
  const zip = new JSZip();
  const folder = zip.folder(`${sanitizeFilename(baseName)}-gambar`) || zip;

  for (const item of renderedImages) {
    const arrayBuffer = await item.blob.arrayBuffer();
    folder.file(item.fileName, arrayBuffer);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const zipFileName = `${sanitizeFilename(baseName)}-gambar-${ext}.zip`;

  return {
    kind: 'zip',
    blob: zipBlob,
    fileName: zipFileName,
    images: renderedImages,
    format: options.format,
    totalCount: renderedImages.length,
  };
}
