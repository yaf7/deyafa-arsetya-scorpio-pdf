import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import html2canvas from 'html2canvas';

export type HtmlPageSize = 'a4' | 'f4' | 'letter' | 'legal';

export const HTML_PAGE_SIZES: Record<
  HtmlPageSize,
  { label: string; widthPt: number; heightPt: number; desc: string; mm: string }
> = {
  a4: {
    label: 'A4 (Standar Internasional & Resmi)',
    widthPt: 595.28,
    heightPt: 841.89,
    desc: 'Standar dokumen resmi kantor, perkuliahan, dan administrasi Indonesia',
    mm: '210 × 297 mm',
  },
  f4: {
    label: 'F4 / Folio (Standar Kedinasan Indonesia)',
    widthPt: 609.45,
    heightPt: 935.43,
    desc: 'Standar surat kedinasan pemerintah, pengadilan, dan instansi Indonesia',
    mm: '215 × 330 mm',
  },
  letter: {
    label: 'US Letter (Standar AS)',
    widthPt: 612.0,
    heightPt: 792.0,
    desc: 'Standar dokumen format Amerika Serikat',
    mm: '216 × 279 mm',
  },
  legal: {
    label: 'US Legal (Dokumen Hukum)',
    widthPt: 612.0,
    heightPt: 1008.0,
    desc: 'Format dokumen hukum panjang Amerika Serikat',
    mm: '216 × 356 mm',
  },
};

export type HtmlOrientation = 'portrait' | 'landscape';

export const HTML_ORIENTATIONS: Record<
  HtmlOrientation,
  { label: string; desc: string }
> = {
  portrait: {
    label: 'Tegak (Portrait)',
    desc: 'Orientasi vertikal ideal untuk surat, artikel, dan invoice',
  },
  landscape: {
    label: 'Mendatar (Landscape)',
    desc: 'Orientasi horizontal ideal untuk sertifikat, tabel lebar, dan presentasi',
  },
};

export type HtmlMargin = 'none' | 'narrow' | 'normal' | 'wide';

export const HTML_MARGINS: Record<
  HtmlMargin,
  { label: string; pt: number; cssPadding: string; desc: string }
> = {
  none: {
    label: 'Tanpa Margin (Full Bleed)',
    pt: 0,
    cssPadding: '0px',
    desc: 'Konten menempel penuh hingga ke tepian kertas',
  },
  narrow: {
    label: 'Sempit (10 mm)',
    pt: 28.35,
    cssPadding: '14px',
    desc: 'Margin tipis untuk memuat lebih banyak konten dalam 1 lembar',
  },
  normal: {
    label: 'Normal (18 mm)',
    pt: 51.02,
    cssPadding: '28px',
    desc: 'Margin standar yang nyaman dibaca dan siap cetak/jilid',
  },
  wide: {
    label: 'Lebar (25 mm)',
    pt: 70.87,
    cssPadding: '42px',
    desc: 'Margin lega untuk laporan formal, tesis, dan proposal',
  },
};

export type HtmlColorMode = 'full' | 'grayscale' | 'clean';

export const HTML_COLOR_MODES: Record<
  HtmlColorMode,
  { label: string; desc: string }
> = {
  full: {
    label: 'Berwarna Asli (Full Color)',
    desc: 'Mempertahankan seluruh warna, gambar, dan gaya latar belakang',
  },
  grayscale: {
    label: 'Skala Abu-Abu (Grayscale)',
    desc: 'Mengubah seluruh warna dokumen menjadi hitam-putih artistik',
  },
  clean: {
    label: 'Hemat Tinta (Tanpa Latar)',
    desc: 'Latar belakang dibersihkan putih polos untuk menghemat tinta cetak',
  },
};

export type HtmlPageNumbering = 'none' | 'bottom-center' | 'bottom-right' | 'top-right';

export const HTML_PAGE_NUMBERINGS: Record<
  HtmlPageNumbering,
  { label: string; tag: string }
> = {
  none: { label: 'Tanpa Nomor', tag: 'Polos' },
  'bottom-center': { label: 'Bawah Tengah (1 dari N)', tag: 'Populer' },
  'bottom-right': { label: 'Bawah Kanan', tag: 'Klasik' },
  'top-right': { label: 'Atas Kanan', tag: 'Header' },
};

export interface HtmlToPdfOptions {
  pageSize: HtmlPageSize;
  orientation: HtmlOrientation;
  margin: HtmlMargin;
  colorMode: HtmlColorMode;
  scalePercent: number; // 75 s.d. 120
  pageNumbering: HtmlPageNumbering;
  outputName?: string;
}

export interface GeneratedHtmlPdfResult {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  pageCount: number;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function stripHtmlExtension(fileName: string): string {
  return fileName.replace(/\.(html|htm)$/i, '');
}

export function sanitizePdfFilename(name: string, fallback = 'dokumen-html'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Eksekusi Konversi Konten HTML ke Dokumen PDF
 */
export async function executeHtmlToPdf(
  containerElement: HTMLElement | HTMLIFrameElement,
  options: HtmlToPdfOptions,
  onProgress?: (current: number, total: number) => void
): Promise<GeneratedHtmlPdfResult> {
  const targetConfig = HTML_PAGE_SIZES[options.pageSize];
  const isLandscape = options.orientation === 'landscape';

  // Dimensi kertas target dalam pt
  const pageW = isLandscape ? targetConfig.heightPt : targetConfig.widthPt;
  const pageH = isLandscape ? targetConfig.widthPt : targetConfig.heightPt;

  // Margin target dalam pt
  const marginPt = HTML_MARGINS[options.margin].pt;
  const printableW = pageW - marginPt * 2;
  const printableH = pageH - marginPt * 2;

  onProgress?.(1, 4);

  // Jika elemen adalah iframe, ambil isi body atau documentElement-nya
  let targetElement: HTMLElement = containerElement;
  if (containerElement instanceof HTMLIFrameElement) {
    const iframeDoc = containerElement.contentDocument;
    if (iframeDoc && (iframeDoc.body || iframeDoc.documentElement)) {
      targetElement = iframeDoc.body || iframeDoc.documentElement;
    }
  }

  // Tangkap kontainer HTML menjadi Canvas resolusi tinggi via html2canvas
  // Selalu gunakan backgroundColor '#ffffff' standar dokumen cetak agar tidak terjadi bug warna transparan/hitam
  const canvas = await html2canvas(targetElement, {
    scale: 2.0, // Skala 2x agar teks dan garis vektor tetap tajam
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: Math.max(targetElement.scrollWidth || 1024, 1024),
    windowHeight: Math.max(targetElement.scrollHeight || 768, 768),
  });

  onProgress?.(2, 4);

  // Jika mode Grayscale, terapkan filter skala abu-abu pada canvas
  if (options.colorMode === 'grayscale') {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }

  // Hitung pemotongan halaman
  // Rasio antara canvas dan area printable PDF
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // Tinggi canvas yang muat dalam 1 halaman printable PDF
  const pageCanvasHeight = (printableH / printableW) * canvasWidth;
  const totalPages = Math.max(1, Math.ceil(canvasHeight / pageCanvasHeight));

  onProgress?.(3, 4);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const srcY = pageIdx * pageCanvasHeight;
    const sliceH = Math.min(pageCanvasHeight, canvasHeight - srcY);

    // Buat canvas potongan halaman
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvasWidth;
    sliceCanvas.height = sliceH;
    const sliceCtx = sliceCanvas.getContext('2d');

    if (sliceCtx) {
      sliceCtx.fillStyle = '#ffffff';
      sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sliceCtx.drawImage(
        canvas,
        0,
        srcY,
        canvasWidth,
        sliceH,
        0,
        0,
        canvasWidth,
        sliceH
      );
    }

    const jpegBlob = await new Promise<Blob | null>((resolve) => {
      sliceCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
    });

    if (!jpegBlob) continue;

    const jpegBuffer = await jpegBlob.arrayBuffer();
    const embeddedImg = await pdfDoc.embedJpg(jpegBuffer);

    const page = pdfDoc.addPage([pageW, pageH]);

    // Hitung proporsi render potongan pada printable area
    const renderWidth = printableW;
    const renderHeight = (sliceH / canvasWidth) * printableW;
    const posY = pageH - marginPt - renderHeight;

    page.drawImage(embeddedImg, {
      x: marginPt,
      y: posY,
      width: renderWidth,
      height: renderHeight,
    });

    // Tambahkan Penomoran Halaman jika diaktifkan
    if (options.pageNumbering !== 'none') {
      const pageText = `${pageIdx + 1} dari ${totalPages}`;
      const fontSize = 9;
      const textW = font.widthOfTextAtSize(pageText, fontSize);

      let numX = (pageW - textW) / 2;
      let numY = 20;

      if (options.pageNumbering === 'bottom-right') {
        numX = pageW - textW - 28;
        numY = 20;
      } else if (options.pageNumbering === 'top-right') {
        numX = pageW - textW - 28;
        numY = pageH - 24;
      }

      page.drawText(pageText, {
        x: numX,
        y: numY,
        size: fontSize,
        font,
        color: rgb(0.4, 0.45, 0.55),
      });
    }
  }

  onProgress?.(4, 4);

  const pdfBytes = await pdfDoc.save();
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const resultBlob = new Blob([copy.buffer], { type: 'application/pdf' });

  const baseName = options.outputName?.trim() || 'dokumen-html-scorpio';

  return {
    blob: resultBlob,
    fileName: sanitizePdfFilename(baseName, 'dokumen-html'),
    sizeBytes: resultBlob.size,
    pageCount: totalPages,
  };
}
