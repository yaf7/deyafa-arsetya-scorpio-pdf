import { degrees, PDFDocument } from 'pdf-lib';

export type ScanFilterType = 'magic-bw' | 'magic-color' | 'grayscale' | 'original';

export interface ScanFilterConfig {
  id: ScanFilterType;
  name: string;
  tag: string;
  desc: string;
  icon: string;
}

export const SCAN_FILTERS: Record<ScanFilterType, ScanFilterConfig> = {
  'magic-color': {
    id: 'magic-color',
    name: 'Warna Tajam (Magic Color)',
    tag: 'Rekomendasi Dokumen',
    desc: 'Membersihkan latar kertas abu-abu/kuning dan mempertajam warna stempel, tanda tangan, serta logo.',
    icon: '✨',
  },
  'magic-bw': {
    id: 'magic-bw',
    name: 'Hitam-Putih Bersih (B&W Scan)',
    tag: 'Teks Super Kontras',
    desc: 'Menghilangkan bayangan dan mengubah teks menjadi hitam pekat dengan latar putih murni ala fotokopi presisi.',
    icon: '📄',
  },
  grayscale: {
    id: 'grayscale',
    name: 'Skala Abu-Abu (Grayscale)',
    tag: 'Arsip Monokrom',
    desc: 'Menghapus warna dan menyelaraskan gradasi abu-abu dokumen untuk keperluan arsip resmi.',
    icon: '🔘',
  },
  original: {
    id: 'original',
    name: 'Foto Asli (Tanpa Efek)',
    tag: 'Warna Alami',
    desc: 'Mempertahankan pencahayaan dan warna asli foto tanpa pemrosesan filter.',
    icon: '📷',
  },
};

export type ScanPageSize = 'a4' | 'f4' | 'letter' | 'fit';

export const SCAN_PAGE_SIZES: Record<
  ScanPageSize,
  { label: string; widthPt: number; heightPt: number; desc: string }
> = {
  a4: {
    label: 'A4 (210 × 297 mm)',
    widthPt: 595.28,
    heightPt: 841.89,
    desc: 'Standar dokumen resmi kantor, administrasi, dan CPNS/BUMN',
  },
  f4: {
    label: 'F4 / Folio (215 × 330 mm)',
    widthPt: 609.45,
    heightPt: 935.43,
    desc: 'Standar surat kedinasan pemerintah dan peradilan Indonesia',
  },
  letter: {
    label: 'US Letter (216 × 279 mm)',
    widthPt: 612.0,
    heightPt: 792.0,
    desc: 'Format dokumen standar internasional Amerika Serikat',
  },
  fit: {
    label: 'Sesuaikan Ukuran Foto (Auto Fit)',
    widthPt: 0,
    heightPt: 0,
    desc: 'Dimensi halaman PDF mengikuti resolusi dan rasio masing-masing foto',
  },
};

export type ScanOrientation = 'auto' | 'portrait' | 'landscape';
export type ScanMargin = 'none' | 'narrow' | 'normal';

export const SCAN_MARGINS: Record<ScanMargin, { label: string; pt: number }> = {
  none: { label: 'Tanpa Margin (Penuh)', pt: 0 },
  narrow: { label: 'Sempit (12 pt)', pt: 12 },
  normal: { label: 'Normal (28 pt)', pt: 28 },
};

export interface ScanPageItem {
  id: string;
  sourceBlob: Blob;
  originalDataUrl: string;
  filteredDataUrl: string;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  filter: ScanFilterType;
}

export interface ScanToPdfOptions {
  pageSize: ScanPageSize;
  orientation: ScanOrientation;
  margin: ScanMargin;
  outputName?: string;
}

export interface GeneratedScanPdfResult {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  pageCount: number;
  pageSize: ScanPageSize;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '');
}

export function sanitizePdfFilename(name: string, fallback = 'dokumen-pindai'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Terapkan filter scanner dokumen pada gambar HTML/Canvas
 */
export function applyScanFilterToCanvas(
  sourceCanvas: HTMLCanvasElement,
  filter: ScanFilterType
): string {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const destCanvas = document.createElement('canvas');
  destCanvas.width = width;
  destCanvas.height = height;
  const ctx = destCanvas.getContext('2d');
  if (!ctx) return sourceCanvas.toDataURL('image/jpeg', 0.92);

  ctx.drawImage(sourceCanvas, 0, 0);

  if (filter === 'original') {
    return destCanvas.toDataURL('image/jpeg', 0.92);
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Filter 1: Magic B&W (Adaptive Thresholding / High Contrast Monochrome)
  if (filter === 'magic-bw') {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Ambang batas cerdas: hapus abu-abu latar kertas jadi putih bersih, teks jadi hitam pekat
      const bw = gray > 140 ? 255 : Math.max(0, gray * 0.4);
      data[i] = bw;
      data[i + 1] = bw;
      data[i + 2] = bw;
    }
  }

  // Filter 2: Magic Color (Enhanced Document Colors)
  else if (filter === 'magic-color') {
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Jika latar kertas terang abu-abu/kuning, dorong ke putih bersih
      if (lum > 175) {
        const boost = (lum - 175) / 80;
        r = Math.min(255, r + (255 - r) * boost);
        g = Math.min(255, g + (255 - g) * boost);
        b = Math.min(255, b + (255 - b) * boost);
      } else {
        // Tingkatkan kontras dan saturasi teks serta stempel/tanda tangan
        r = Math.max(0, Math.min(255, (r - 128) * 1.35 + 128));
        g = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128));
        b = Math.max(0, Math.min(255, (b - 128) * 1.35 + 128));
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }

  // Filter 3: Grayscale
  else if (filter === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Sedikit peregangan kontras untuk keterbacaan teks
      const enhanced = Math.max(0, Math.min(255, (gray - 128) * 1.2 + 128));
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return destCanvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Muat file gambar ke Canvas dan ekstrak dimensi serta DataURL
 */
export async function processImageFileToScanItem(
  file: File | Blob,
  filter: ScanFilterType = 'magic-color'
): Promise<ScanPageItem> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || 1200;
  canvas.height = img.naturalHeight || 1600;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  }

  const filteredDataUrl = applyScanFilterToCanvas(canvas, filter);

  return {
    id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    sourceBlob: file,
    originalDataUrl: dataUrl,
    filteredDataUrl,
    width: canvas.width,
    height: canvas.height,
    rotation: 0,
    filter,
  };
}

/**
 * Buat dokumen PDF multi-halaman dari kumpulan gambar hasil pindai
 */
export async function compileScanPagesToPdf(
  pages: ScanPageItem[],
  options: ScanToPdfOptions,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<GeneratedScanPdfResult> {
  if (pages.length === 0) {
    throw new Error('Pilih atau ambil minimal 1 foto dokumen untuk dipindai.');
  }

  onProgress?.(1, 3, 'Memproses filter gambar dan orientasi lembar...');
  const pdfDoc = await PDFDocument.create();

  const marginPt = SCAN_MARGINS[options.margin].pt;

  for (let idx = 0; idx < pages.length; idx++) {
    const pageItem = pages[idx];
    onProgress?.(
      2,
      3,
      `Menyusun lembar ${idx + 1} dari ${pages.length}...`
    );

    // Dapatkan data URL gambar yang sudah difilter dan diputar
    const finalCanvas = document.createElement('canvas');
    const isRotated90or270 = pageItem.rotation === 90 || pageItem.rotation === 270;
    const finalW = isRotated90or270 ? pageItem.height : pageItem.width;
    const finalH = isRotated90or270 ? pageItem.width : pageItem.height;

    finalCanvas.width = finalW;
    finalCanvas.height = finalH;
    const ctx = finalCanvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalW, finalH);

      ctx.save();
      ctx.translate(finalW / 2, finalH / 2);
      ctx.rotate((pageItem.rotation * Math.PI) / 180);
      ctx.drawImage(
        await (async () => {
          const tempImg = new Image();
          await new Promise<void>((res) => {
            tempImg.onload = () => res();
            tempImg.src = pageItem.filteredDataUrl;
          });
          return tempImg;
        })(),
        -pageItem.width / 2,
        -pageItem.height / 2
      );
      ctx.restore();
    }

    const jpegDataUrl = finalCanvas.toDataURL('image/jpeg', 0.92);
    const jpegBytes = await fetch(jpegDataUrl).then((r) => r.arrayBuffer());
    const embeddedImg = await pdfDoc.embedJpg(jpegBytes);

    // Tentukan ukuran kertas
    let pageW = 0;
    let pageH = 0;

    if (options.pageSize === 'fit') {
      pageW = finalW;
      pageH = finalH;
    } else {
      const standardSize = SCAN_PAGE_SIZES[options.pageSize];
      let targetW = standardSize.widthPt;
      let targetH = standardSize.heightPt;

      if (options.orientation === 'landscape') {
        pageW = targetH;
        pageH = targetW;
      } else if (options.orientation === 'portrait') {
        pageW = targetW;
        pageH = targetH;
      } else {
        // Auto: jika gambar lebih lebar dari tingginya, buat landscape
        if (finalW > finalH) {
          pageW = targetH;
          pageH = targetW;
        } else {
          pageW = targetW;
          pageH = targetH;
        }
      }
    }

    const page = pdfDoc.addPage([pageW, pageH]);

    // Hitung penempatan gambar dengan mempertimbangkan margin
    const availW = Math.max(10, pageW - marginPt * 2);
    const availH = Math.max(10, pageH - marginPt * 2);

    const scale = Math.min(availW / finalW, availH / finalH);
    const renderW = finalW * scale;
    const renderH = finalH * scale;

    const posX = marginPt + (availW - renderW) / 2;
    const posY = marginPt + (availH - renderH) / 2;

    page.drawImage(embeddedImg, {
      x: posX,
      y: posY,
      width: renderW,
      height: renderH,
    });
  }

  onProgress?.(3, 3, 'Menyusun berkas PDF akhir...');
  pdfDoc.setTitle(options.outputName || 'Dokumen Pindai');
  pdfDoc.setProducer('Deyafa Arsetya ScorpioPDF CamScanner Engine');
  pdfDoc.setCreator('ScorpioPDF (https://scorpio-pdf.local)');
  pdfDoc.setCreationDate(new Date());

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const pdfBlob = new Blob([copy.buffer], { type: 'application/pdf' });

  const finalName = sanitizePdfFilename(
    options.outputName ? options.outputName : 'dokumen-pindai-scorpio'
  );

  return {
    blob: pdfBlob,
    fileName: finalName,
    sizeBytes: pdfBlob.size,
    pageCount: pages.length,
    pageSize: options.pageSize,
  };
}
