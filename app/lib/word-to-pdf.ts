import { PDFDocument } from 'pdf-lib';

export type WordPageSize = 'original' | 'a4' | 'f4' | 'letter';

export const WORD_PAGE_SIZES: Record<
  WordPageSize,
  { label: string; widthPt: number; heightPt: number; desc: string }
> = {
  original: {
    label: 'Sesuai Dokumen Word',
    widthPt: 595.28,
    heightPt: 841.89,
    desc: 'Mempertahankan ukuran & tata letak asli dari file Word',
  },
  a4: {
    label: 'A4 (210 × 297 mm)',
    widthPt: 595.28,
    heightPt: 841.89,
    desc: 'Standar dokumen Indonesia & internasional',
  },
  f4: {
    label: 'F4 / Folio (215 × 330 mm)',
    widthPt: 609.45,
    heightPt: 935.43,
    desc: 'Standar kertas kedinasan & legal Indonesia',
  },
  letter: {
    label: 'US Letter (216 × 279 mm)',
    widthPt: 612.0,
    heightPt: 792.0,
    desc: 'Standar format dokumen Amerika Serikat',
  },
};

export type WordRenderQuality = 'high' | 'ultra' | 'standard';

export const WORD_RENDER_QUALITIES: Record<
  WordRenderQuality,
  { label: string; scale: number; jpegQuality: number; desc: string }
> = {
  high: {
    label: 'Tinggi (Rekomendasi)',
    scale: 2.0,
    jpegQuality: 0.92,
    desc: 'Kualitas tajam, rendering cepat & seimbang (2x)',
  },
  ultra: {
    label: 'Ultra HD (Cetak)',
    scale: 2.6,
    jpegQuality: 0.97,
    desc: 'Detail teks maksimum untuk cetak resolusi tinggi',
  },
  standard: {
    label: 'Standar (Ringan)',
    scale: 1.5,
    jpegQuality: 0.85,
    desc: 'Ukuran file PDF lebih kecil & hemat memori',
  },
};

export interface WordToPdfOptions {
  pageSize: WordPageSize;
  quality: WordRenderQuality;
  outputName?: string;
}

export interface GeneratedWordPdfResult {
  blob: Blob;
  fileName: string;
  pageCount: number;
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

export function stripWordExtension(fileName: string): string {
  return fileName.replace(/\.(docx|doc)$/i, '');
}

export function sanitizePdfFilename(name: string, fallback = 'dokumen-word'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Render file DOCX ke dalam container HTML menggunakan docx-preview
 */
export async function renderDocxToElement(
  file: File,
  container: HTMLElement
): Promise<{ pageCount: number }> {
  if (typeof window === 'undefined') {
    throw new Error('Konversi Word hanya dapat dijalankan di browser.');
  }

  const docx = await import('docx-preview');
  const arrayBuffer = await file.arrayBuffer();

  // Kosongkan container sebelum render baru
  container.innerHTML = '';

  try {
    await docx.renderAsync(arrayBuffer, container, undefined, {
      inWrapper: true,
      breakPages: true,
      experimental: true,
      trimXmlDeclaration: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Content_Types') || file.name.toLowerCase().endsWith('.doc')) {
      throw new Error(
        'File ini terdeteksi sebagai format Word lama (.doc / Word 97-2003). Silakan simpan ulang sebagai .docx (Word Modern) untuk mengonversi secara otomatis.'
      );
    }
    throw new Error(`Gagal membaca struktur dokumen Word: ${msg}`);
  }

  // Hitung jumlah halaman dari section.docx yang dirender docx-preview
  const sections = container.querySelectorAll('section.docx');
  const count = sections.length > 0 ? sections.length : 1;

  return { pageCount: count };
}

/**
 * Konversi halaman-halaman yang sudah dirender di DOM menjadi dokumen PDF resmi
 */
export async function convertRenderedDocxToPdf(
  container: HTMLElement,
  options: WordToPdfOptions,
  fallbackBaseName: string,
  onProgress?: (current: number, total: number) => void
): Promise<GeneratedWordPdfResult> {
  const html2canvasModule = await import('html2canvas');
  const html2canvas = html2canvasModule.default || html2canvasModule;

  // Temukan elemen-elemen halaman
  let pageElements = Array.from(
    container.querySelectorAll('section.docx')
  ) as HTMLElement[];

  // Fallback bila docx-preview tidak memecah ke section terpisah
  if (pageElements.length === 0) {
    const wrapper = container.querySelector('.docx-wrapper') as HTMLElement | null;
    pageElements = wrapper ? [wrapper] : [container];
  }

  const totalPages = pageElements.length;
  const qualityConfig =
    WORD_RENDER_QUALITIES[options.quality] || WORD_RENDER_QUALITIES['high'];
  const targetPageSize =
    WORD_PAGE_SIZES[options.pageSize] || WORD_PAGE_SIZES['a4'];

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setCreator('Deyafa Arsetya ScorpioPDF');
  pdfDoc.setProducer('Deyafa Arsetya ScorpioPDF');

  for (let i = 0; i < totalPages; i++) {
    onProgress?.(i + 1, totalPages);
    const element = pageElements[i];

    // Render halaman DOM ke kanvas gambar resolusi tinggi
    const canvas = await html2canvas(element, {
      scale: qualityConfig.scale,
      useCORS: true,
      backgroundColor: '#FFFFFF',
      logging: false,
    });

    const dataUrl = canvas.toDataURL('image/jpeg', qualityConfig.jpegQuality);
    const base64Data = dataUrl.split(',')[1];
    const binaryStr = atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let j = 0; j < len; j++) {
      bytes[j] = binaryStr.charCodeAt(j);
    }

    const embeddedImage = await pdfDoc.embedJpg(bytes);

    // Hitung ukuran halaman PDF
    let pageWidthPt = targetPageSize.widthPt;
    let pageHeightPt = targetPageSize.heightPt;

    if (options.pageSize === 'original') {
      // Gunakan rasio asli dari kanvas
      const canvasAspect = canvas.width / canvas.height;
      pageWidthPt = 595.28;
      pageHeightPt = pageWidthPt / canvasAspect;
    }

    const pdfPage = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

    // Gambar kanvas memenuhi halaman
    pdfPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pageWidthPt,
      height: pageHeightPt,
    });

    // Beri jeda micro-tick agar UI progress tetap mulus
    await new Promise((r) => setTimeout(r, 0));
  }

  const pdfBytes = await pdfDoc.save();
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });

  const finalName = sanitizePdfFilename(
    options.outputName?.trim() || fallbackBaseName,
    'ScorpioPDF-Dokumen'
  );

  return {
    blob,
    fileName: finalName,
    pageCount: totalPages,
    sizeBytes: blob.size,
  };
}

