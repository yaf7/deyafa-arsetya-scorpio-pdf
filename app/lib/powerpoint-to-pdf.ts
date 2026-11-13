import { PDFDocument } from 'pdf-lib';
import type { LoadedPresentation } from 'pptx-viewer';

export type PptxPageSize =
  | 'original'
  | 'a4-landscape'
  | 'f4-landscape'
  | 'letter-landscape'
  | 'a4-portrait';

export const PPTX_PAGE_SIZES: Record<
  PptxPageSize,
  { label: string; widthPt: number; heightPt: number; desc: string }
> = {
  original: {
    label: 'Sesuai Asli Slide (16:9 / 4:3)',
    widthPt: 960.0,
    heightPt: 540.0,
    desc: 'Mempertahankan rasio dan dimensi asli presentasi tanpa terpotong',
  },
  'a4-landscape': {
    label: 'A4 Mendatar / Landscape (297 × 210 mm)',
    widthPt: 841.89,
    heightPt: 595.28,
    desc: 'Standar cetak dokumen presentasi Indonesia & internasional',
  },
  'f4-landscape': {
    label: 'F4 / Folio Mendatar (330 × 215 mm)',
    widthPt: 935.43,
    heightPt: 609.45,
    desc: 'Standar kertas kedinasan & perkantoran Indonesia',
  },
  'letter-landscape': {
    label: 'US Letter Landscape (279 × 216 mm)',
    widthPt: 792.0,
    heightPt: 612.0,
    desc: 'Standar format dokumen lanskap Amerika Serikat',
  },
  'a4-portrait': {
    label: 'A4 Tegak / Portrait (210 × 297 mm)',
    widthPt: 595.28,
    heightPt: 841.89,
    desc: 'Format dokumen vertikal / catatan handout',
  },
};

export type PptxRenderQuality = 'high' | 'ultra' | 'standard';

export const PPTX_RENDER_QUALITIES: Record<
  PptxRenderQuality,
  { label: string; scale: number; jpegQuality: number; desc: string }
> = {
  high: {
    label: 'Tinggi — 1080p Full HD (Rekomendasi)',
    scale: 2.0,
    jpegQuality: 0.92,
    desc: 'Teks sangat tajam, rendering cepat & seimbang',
  },
  ultra: {
    label: 'Ultra HD — 4K (Siap Cetak / Proyektor)',
    scale: 3.0,
    jpegQuality: 0.96,
    desc: 'Kualitas grafis maksimum untuk presentasi resolusi tinggi',
  },
  standard: {
    label: 'Standar — 720p (Ringan & Hemat Kuota)',
    scale: 1.333,
    jpegQuality: 0.85,
    desc: 'Ukuran file PDF lebih kecil untuk pengiriman pesan / email',
  },
};

export type PptxFitMode = 'fill' | 'fit';

export const PPTX_FIT_MODES: Record<
  PptxFitMode,
  { label: string; desc: string }
> = {
  fill: {
    label: 'Penuh Halaman (Full Bleed)',
    desc: 'Slide memenuhi seluruh bidang halaman PDF dari ujung ke ujung',
  },
  fit: {
    label: 'Pas ke Halaman (Dengan Margin Rapi)',
    desc: 'Slide diposisikan di tengah dengan proporsi terjaga dan margin seimbang',
  },
};

export interface SlideSummary {
  slideIndex: number; // 0-indexed
  slideNumber: number; // 1-indexed
  thumbnailUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
}

export interface ManagedPptxFile {
  id: string;
  file: File;
  name: string;
  size: number;
  slideCount: number;
  slideSize: { width: number; height: number };
  isWidescreen: boolean;
  slides: SlideSummary[];
  presentation: LoadedPresentation;
}

export interface PowerpointToPdfOptions {
  pageSize: PptxPageSize;
  quality: PptxRenderQuality;
  fitMode: PptxFitMode;
  selectedSlides: number[]; // 0-indexed
  outputName?: string;
}

export interface GeneratedPptxPdfResult {
  blob: Blob;
  fileName: string;
  slideCount: number;
  sizeBytes: number;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function stripPptxExtension(fileName: string): string {
  return fileName.replace(/\.(pptx|ppt)$/i, '');
}

export function sanitizePdfFilename(name: string, fallback = 'presentasi-powerpoint'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Muat file PowerPoint dan buat thumbnail SVG tiap slide
 */
export async function loadPptxDocument(
  file: File
): Promise<ManagedPptxFile> {
  if (typeof window === 'undefined') {
    throw new Error('Konversi PowerPoint hanya dapat dijalankan di browser.');
  }

  const { loadPresentation, getThumbnails } = await import('pptx-viewer');

  let presentation: LoadedPresentation;
  try {
    presentation = await loadPresentation(file);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (file.name.toLowerCase().endsWith('.ppt')) {
      throw new Error(
        'File ini merupakan format PowerPoint lama (.ppt / PowerPoint 97-2003). Silakan simpan ulang sebagai .pptx (PowerPoint Modern) untuk dapat dikonversi langsung secara otomatis.'
      );
    }
    throw new Error(`Gagal membuka file presentasi PowerPoint: ${msg}`);
  }

  const slideCount = presentation.slides.length;
  if (slideCount === 0) {
    throw new Error('File presentasi tidak memiliki slide untuk dikonversi.');
  }

  const slideWidth = presentation.slideSize?.width || 960;
  const slideHeight = presentation.slideSize?.height || 540;
  const aspectRatio = slideWidth / slideHeight;
  const isWidescreen = aspectRatio > 1.5; // ~16:9 adalah 1.777, ~4:3 adalah 1.333

  // Ekstrak thumbnail SVG untuk tiap slide
  const svgElements = getThumbnails(presentation, 320);
  const serializer = new XMLSerializer();
  const slides: SlideSummary[] = [];

  for (let i = 0; i < slideCount; i++) {
    let thumbUrl = '';
    const svg = svgElements[i];
    if (svg) {
      try {
        const svgStr = serializer.serializeToString(svg);
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        thumbUrl = URL.createObjectURL(blob);
      } catch {
        thumbUrl = '';
      }
    }

    slides.push({
      slideIndex: i,
      slideNumber: i + 1,
      thumbnailUrl: thumbUrl,
      width: slideWidth,
      height: slideHeight,
      aspectRatio,
    });
  }

  return {
    id: `pptx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    name: file.name,
    size: file.size,
    slideCount,
    slideSize: { width: slideWidth, height: slideHeight },
    isWidescreen,
    slides,
    presentation,
  };
}

/**
 * Konversi slide presentasi menjadi dokumen PDF
 */
export async function convertPptxToPdf(
  managed: ManagedPptxFile,
  options: PowerpointToPdfOptions,
  onProgress?: (current: number, total: number) => void
): Promise<GeneratedPptxPdfResult> {
  const { renderSlideToCanvas } = await import('pptx-viewer');

  const { presentation } = managed;
  const selectedIndices = (
    options.selectedSlides.length > 0
      ? options.selectedSlides
      : Array.from({ length: managed.slideCount }, (_, i) => i)
  )
    .filter((idx) => idx >= 0 && idx < managed.slideCount)
    .sort((a, b) => a - b);

  if (selectedIndices.length === 0) {
    throw new Error('Pilih minimal satu slide untuk dikonversi.');
  }

  const qualityConfig =
    PPTX_RENDER_QUALITIES[options.quality] || PPTX_RENDER_QUALITIES.high;

  // Tentukan ukuran halaman PDF
  const baseSlideWidth = managed.slideSize.width || 960;
  const baseSlideHeight = managed.slideSize.height || 540;
  const slideAspect = baseSlideWidth / baseSlideHeight;

  let pageDefaultWidthPt: number;
  let pageDefaultHeightPt: number;

  if (options.pageSize === 'original') {
    // Sesuaikan rasio slide asli dalam satuan points
    if (managed.isWidescreen) {
      pageDefaultWidthPt = 960.0;
      pageDefaultHeightPt = 540.0;
    } else {
      pageDefaultWidthPt = 720.0;
      pageDefaultHeightPt = 540.0;
    }
  } else {
    const config = PPTX_PAGE_SIZES[options.pageSize];
    pageDefaultWidthPt = config.widthPt;
    pageDefaultHeightPt = config.heightPt;
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(options.outputName || stripPptxExtension(managed.name));
  pdfDoc.setCreator('Deyafa Arsetya ScorpioPDF');
  pdfDoc.setProducer('Deyafa Arsetya ScorpioPDF');

  // Siapkan canvas untuk rendering slide beresolusi tinggi
  const renderWidthPx = Math.round(baseSlideWidth * qualityConfig.scale);
  const renderHeightPx = Math.round(baseSlideHeight * qualityConfig.scale);

  const canvas = document.createElement('canvas');
  canvas.width = renderWidthPx;
  canvas.height = renderHeightPx;

  for (let i = 0; i < selectedIndices.length; i++) {
    const slideIdx = selectedIndices[i];
    onProgress?.(i + 1, selectedIndices.length);

    // 1. Render slide ke canvas
    await renderSlideToCanvas(presentation, slideIdx, canvas);

    // 2. Ekspor ke Blob JPEG
    const jpegBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', qualityConfig.jpegQuality)
    );

    if (!jpegBlob) {
      throw new Error(`Gagal merender slide ${slideIdx + 1} ke format gambar.`);
    }

    const jpegBuffer = await jpegBlob.arrayBuffer();
    const embeddedImage = await pdfDoc.embedJpg(new Uint8Array(jpegBuffer));

    // 3. Tambahkan halaman ke PDF
    const page = pdfDoc.addPage([pageDefaultWidthPt, pageDefaultHeightPt]);

    // 4. Hitung posisi dan ukuran sesuai fitMode
    let drawWidth = pageDefaultWidthPt;
    let drawHeight = pageDefaultHeightPt;
    let offsetX = 0;
    let offsetY = 0;

    if (options.fitMode === 'fit') {
      const pageAspect = pageDefaultWidthPt / pageDefaultHeightPt;
      if (slideAspect > pageAspect) {
        // Slide lebih lebar dari halaman (pilar atas bawah)
        drawWidth = pageDefaultWidthPt;
        drawHeight = pageDefaultWidthPt / slideAspect;
        offsetX = 0;
        offsetY = (pageDefaultHeightPt - drawHeight) / 2;
      } else {
        // Slide lebih tinggi dari halaman (pilar kiri kanan)
        drawHeight = pageDefaultHeightPt;
        drawWidth = pageDefaultHeightPt * slideAspect;
        offsetX = (pageDefaultWidthPt - drawWidth) / 2;
        offsetY = 0;
      }
    }

    page.drawImage(embeddedImage, {
      x: offsetX,
      y: offsetY,
      width: drawWidth,
      height: drawHeight,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const pdfBlob = new Blob([copy.buffer], { type: 'application/pdf' });
  const finalFileName = sanitizePdfFilename(
    options.outputName || stripPptxExtension(managed.name)
  );

  return {
    blob: pdfBlob,
    fileName: finalFileName,
    slideCount: selectedIndices.length,
    sizeBytes: pdfBlob.size,
  };
}
