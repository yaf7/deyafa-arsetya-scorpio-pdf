import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from 'docx';

export type WordPageSize = 'a4' | 'f4' | 'letter' | 'original';

export const WORD_PAGE_SIZES: Record<
  WordPageSize,
  { label: string; widthDxa: number; heightDxa: number; widthPt: number; heightPt: number; desc: string }
> = {
  a4: {
    label: 'A4 (210 × 297 mm)',
    widthDxa: 11906,
    heightDxa: 16838,
    widthPt: 595.28,
    heightPt: 841.89,
    desc: 'Standar dokumen Indonesia & internasional',
  },
  f4: {
    label: 'F4 / Folio (215 × 330 mm)',
    widthDxa: 12189,
    heightDxa: 18709,
    widthPt: 609.45,
    heightPt: 935.43,
    desc: 'Standar kertas kedinasan, perkantoran & legal Indonesia',
  },
  letter: {
    label: 'US Letter (216 × 279 mm)',
    widthDxa: 12240,
    heightDxa: 15840,
    widthPt: 612.0,
    heightPt: 792.0,
    desc: 'Standar format dokumen Amerika Serikat',
  },
  original: {
    label: 'Sesuai PDF Asli',
    widthDxa: 11906,
    heightDxa: 16838,
    widthPt: 595.28,
    heightPt: 841.89,
    desc: 'Mengikuti rasio dan ukuran dimensi tiap halaman PDF',
  },
};

export type DocxMarginOption = 'normal' | 'narrow' | 'wide' | 'none';

export const DOCX_MARGIN_CONFIG: Record<
  DocxMarginOption,
  { label: string; dxa: number; desc: string }
> = {
  normal: {
    label: 'Normal (2.54 cm / 1 Inci)',
    dxa: 1440,
    desc: 'Margin standar Microsoft Word yang rapi & berimbang',
  },
  narrow: {
    label: 'Sempit (1.27 cm / 0.5 Inci)',
    dxa: 720,
    desc: 'Memaksimalkan ruang teks dan tabel di atas kertas',
  },
  wide: {
    label: 'Lebar (3.81 cm / 1.5 Inci)',
    dxa: 2160,
    desc: 'Beri ruang catatan tepi atau penjilidan dokumen',
  },
  none: {
    label: 'Tanpa Margin (0 cm)',
    dxa: 0,
    desc: 'Cocok untuk dokumen visual penuh atau desain poster',
  },
};

export type PdfToWordMode = 'editable' | 'visual' | 'text-only';

export const PDF_TO_WORD_MODES: Record<
  PdfToWordMode,
  { label: string; tag: string; desc: string; icon: string }
> = {
  editable: {
    label: 'Teks & Paragraf Diedit (Rekomendasi)',
    tag: 'Paling Fleksibel',
    desc: 'Mengekstrak teks, mendeteksi judul/heading, penomoran, paragraf, serta menyertakan visual otomatis bila halaman berupa hasil scan.',
    icon: 'text',
  },
  visual: {
    label: 'Tata Letak Visual Utuh (Scanned/Desain)',
    tag: '100% Persis PDF',
    desc: 'Merender setiap halaman menjadi visual dokumen beresolusi tajam di Word. Sangat cocok untuk sertifikat, formulir bertanda tangan, atau brosur.',
    icon: 'image',
  },
  'text-only': {
    label: 'Teks Murni Saja (Ekstraksi Cepat)',
    tag: 'Tanpa Gambar',
    desc: 'Hanya mengambil teks bersih dan heading tanpa gambar latar. Menghasilkan file Word yang sangat ringan untuk keperluan penyuntingan cepat.',
    icon: 'clean',
  },
};

export interface PdfPageSummary {
  pageNumber: number; // 1-indexed
  widthPt: number;
  heightPt: number;
  aspectRatio: number;
  thumbnailUrl: string;
  hasText: boolean;
  charCount: number;
  textSnippet: string;
}

export interface ManagedPdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  pages: PdfPageSummary[];
  totalChars: number;
  hasScannedPages: boolean;
}

export interface PdfToWordOptions {
  mode: PdfToWordMode;
  pageSize: WordPageSize;
  margin: DocxMarginOption;
  selectedPages: number[]; // 1-indexed
  includePageBreaks: boolean;
  outputName?: string;
}

export interface GeneratedDocxResult {
  blob: Blob;
  fileName: string;
  pageCount: number;
  sizeBytes: number;
  mode: PdfToWordMode;
  stats: {
    totalParagraphs: number;
    totalWords: number;
    visualPagesCount: number;
  };
}

type AlignmentValue = (typeof AlignmentType)[keyof typeof AlignmentType];
type HeadingValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF to Word hanya dapat dijalankan di browser.');
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

export function sanitizeDocxFilename(name: string, fallback = 'dokumen-word'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.docx') ? base : `${base}.docx`;
}

/**
 * Muat file PDF, buat thumbnail tiap halaman dan hitung kepadatan teks
 */
export async function inspectPdfForWord(
  file: File,
  onThumbnailReady?: (pageNum: number, summary: PdfPageSummary) => void
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

  let grandTotalChars = 0;
  let scannedCount = 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    // 1. Ekstrak cuplikan teks
    let charCount = 0;
    let snippet = '';
    try {
      const textContent = await page.getTextContent();
      const rawText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ');
      charCount = rawText.trim().length;
      snippet = rawText.trim().replace(/\s+/g, ' ').slice(0, 160);
      grandTotalChars += charCount;
    } catch {
      charCount = 0;
      snippet = '';
    }

    const hasText = charCount >= 25;
    if (!hasText) scannedCount++;

    // 2. Buat thumbnail visual cepat (skala 0.35)
    let thumbUrl = '';
    try {
      const thumbScale = Math.min(0.4, 260 / Math.max(viewport.width, viewport.height));
      const thumbViewport = page.getViewport({ scale: thumbScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(thumbViewport.width));
      canvas.height = Math.max(1, Math.round(thumbViewport.height));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport: thumbViewport,
        }).promise;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.8)
        );
        if (blob) {
          thumbUrl = URL.createObjectURL(blob);
        }
      }
    } catch {
      thumbUrl = '';
    }

    const summary: PdfPageSummary = {
      pageNumber: pageNum,
      widthPt: Math.round(viewport.width),
      heightPt: Math.round(viewport.height),
      aspectRatio: viewport.width / viewport.height,
      thumbnailUrl: thumbUrl,
      hasText,
      charCount,
      textSnippet: snippet,
    };

    pages.push(summary);
    if (onThumbnailReady) {
      onThumbnailReady(pageNum, summary);
    }
  }

  return {
    id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    file,
    name: file.name,
    size: file.size,
    pageCount,
    pages,
    totalChars: grandTotalChars,
    hasScannedPages: scannedCount > 0,
  };
}

interface RawPdfItem {
  str: string;
  tx: number;
  ty: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
}

interface ReconstructedLine {
  items: RawPdfItem[];
  text: string;
  y: number;
  minX: number;
  maxX: number;
  maxFontSize: number;
  isBold: boolean;
  isBullet: boolean;
  alignment: AlignmentValue;
}

/**
 * Kelompokkan item teks PDF menjadi baris dan paragraf yang terstruktur
 */
function reconstructPageText(
  rawItems: RawPdfItem[],
  pageWidthPt: number
): Paragraph[] {
  if (rawItems.length === 0) return [];

  // 1. Urutkan item teks dari atas ke bawah (ty tinggi ke rendah)
  const items = [...rawItems].sort((a, b) => {
    if (Math.abs(a.ty - b.ty) > 3.5) {
      return b.ty - a.ty;
    }
    return a.tx - b.tx;
  });

  // 2. Kelompokkan item menjadi baris berdasarkan kesamaan koordinat vertikal (ty)
  const lines: ReconstructedLine[] = [];
  let currentGroup: RawPdfItem[] = [];
  let currentY = items[0].ty;

  for (const item of items) {
    if (currentGroup.length === 0) {
      currentGroup.push(item);
      currentY = item.ty;
    } else if (Math.abs(item.ty - currentY) <= 3.5) {
      currentGroup.push(item);
    } else {
      // Selesaikan baris saat ini
      currentGroup.sort((a, b) => a.tx - b.tx);
      lines.push(buildLineObject(currentGroup, currentY, pageWidthPt));
      currentGroup = [item];
      currentY = item.ty;
    }
  }

  if (currentGroup.length > 0) {
    currentGroup.sort((a, b) => a.tx - b.tx);
    lines.push(buildLineObject(currentGroup, currentY, pageWidthPt));
  }

  // 3. Kelompokkan baris menjadi paragraf Word
  const paragraphs: Paragraph[] = [];
  let currentParaLines: ReconstructedLine[] = [];

  const flushParagraph = () => {
    if (currentParaLines.length === 0) return;

    const firstLine = currentParaLines[0];
    const isHeading1 = firstLine.maxFontSize >= 19;
    const isHeading2 = firstLine.maxFontSize >= 14 && firstLine.maxFontSize < 19;
    const isHeading3 = firstLine.maxFontSize >= 12 && firstLine.isBold;

    let heading: HeadingValue | undefined;
    if (isHeading1) heading = HeadingLevel.HEADING_1;
    else if (isHeading2) heading = HeadingLevel.HEADING_2;
    else if (isHeading3) heading = HeadingLevel.HEADING_3;

    // Rakit TextRun untuk paragraf ini
    const runs: TextRun[] = [];

    currentParaLines.forEach((line, lineIdx) => {
      line.items.forEach((item, itemIdx) => {
        // Cek spasi otomatis jika item sebelumnya terpisah jarak
        if (itemIdx > 0) {
          const prev = line.items[itemIdx - 1];
          const gap = item.tx - (prev.tx + prev.width);
          if (gap > 2 && !prev.str.endsWith(' ') && !item.str.startsWith(' ')) {
            runs.push(new TextRun({ text: ' ' }));
          }
        }

        runs.push(
          new TextRun({
            text: item.str,
            bold: item.isBold,
            italics: item.isItalic,
            size: Math.max(16, Math.min(56, Math.round(item.fontSize * 2))), // Word font size dalam half-points (11pt = 22)
          })
        );
      });

      // Tambahkan spasi antar baris dalam satu paragraf jika bukan baris terakhir
      if (lineIdx < currentParaLines.length - 1) {
        runs.push(new TextRun({ text: ' ' }));
      }
    });

    const isBulletPara = firstLine.isBullet;

    paragraphs.push(
      new Paragraph({
        heading,
        alignment: firstLine.alignment,
        bullet: isBulletPara ? { level: 0 } : undefined,
        spacing: {
          before: heading ? 240 : 80,
          after: heading ? 120 : 120,
          line: 276, // 1.15 line spacing
        },
        children: runs,
      })
    );

    currentParaLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (currentParaLines.length === 0) {
      currentParaLines.push(line);
      continue;
    }

    const prevLine = currentParaLines[currentParaLines.length - 1];
    const verticalGap = prevLine.y - line.y;
    const isBigGap = verticalGap > Math.max(16, prevLine.maxFontSize * 1.7);
    const hasHeading = line.maxFontSize >= 14 || prevLine.maxFontSize >= 14;
    const isBullet = line.isBullet;
    const diffAlignment = line.alignment !== prevLine.alignment;

    if (isBigGap || hasHeading || isBullet || diffAlignment) {
      flushParagraph();
      currentParaLines.push(line);
    } else {
      currentParaLines.push(line);
    }
  }

  flushParagraph();
  return paragraphs;
}

function buildLineObject(
  items: RawPdfItem[],
  y: number,
  pageWidthPt: number
): ReconstructedLine {
  const text = items.map((i) => i.str).join(' ').trim();
  const minX = items[0]?.tx ?? 0;
  const lastItem = items[items.length - 1];
  const maxX = (lastItem?.tx ?? 0) + (lastItem?.width ?? 0);
  const maxFontSize = Math.max(...items.map((i) => i.fontSize), 10);
  const isBold = items.some((i) => i.isBold);

  // Deteksi bullet
  const isBullet = /^[•\-\*\u2022]\s+/.test(text) || /^\d+[\.\)]\s+/.test(text);

  // Deteksi perataan posisi horizontal
  const lineCenter = (minX + maxX) / 2;
  const pageCenter = pageWidthPt / 2;
  const lineWidth = maxX - minX;

  let alignment: AlignmentValue = AlignmentType.LEFT;
  if (Math.abs(lineCenter - pageCenter) < 35 && lineWidth < pageWidthPt * 0.75) {
    alignment = AlignmentType.CENTER;
  } else if (minX > pageWidthPt * 0.55) {
    alignment = AlignmentType.RIGHT;
  }

  return {
    items,
    text,
    y,
    minX,
    maxX,
    maxFontSize,
    isBold,
    isBullet,
    alignment,
  };
}

/**
 * Render satu halaman PDF menjadi Uint8Array PNG beresolusi tinggi
 */
async function renderPageToPngBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  scale = 2.0
): Promise<{ buffer: Uint8Array; widthPx: number; heightPx: number }> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) throw new Error('Gagal merender halaman PDF menjadi gambar.');

  const arrayBuffer = await blob.arrayBuffer();
  return {
    buffer: new Uint8Array(arrayBuffer),
    widthPx: canvas.width,
    heightPx: canvas.height,
  };
}

/**
 * Eksekusi konversi utama dari PDF ke file Word (.docx)
 */
export async function convertPdfToDocx(
  file: File,
  options: PdfToWordOptions,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<GeneratedDocxResult> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPagesInPdf = pdfDoc.numPages;

  // Filter halaman yang dipilih pengguna
  const pagesToProcess = (
    options.selectedPages.length > 0
      ? options.selectedPages
      : Array.from({ length: totalPagesInPdf }, (_, i) => i + 1)
  )
    .filter((num) => num >= 1 && num <= totalPagesInPdf)
    .sort((a, b) => a - b);

  if (pagesToProcess.length === 0) {
    throw new Error('Tidak ada halaman PDF yang dipilih untuk dikonversi.');
  }

  const selectedSize = WORD_PAGE_SIZES[options.pageSize];
  const marginDxa = DOCX_MARGIN_CONFIG[options.margin].dxa;

  // Lebar area yang bisa diisi konten dalam satuan points (~dxa / 20)
  const printableWidthPt = Math.max(200, (selectedSize.widthDxa - marginDxa * 2) / 20);

  const documentChildren: Paragraph[] = [];
  let totalParagraphsCount = 0;
  let totalWordsCount = 0;
  let visualPagesCount = 0;

  for (let idx = 0; idx < pagesToProcess.length; idx++) {
    const pageNum = pagesToProcess[idx];
    const isFirstPage = idx === 0;

    if (onProgress) {
      onProgress(
        idx + 1,
        pagesToProcess.length,
        `Memproses halaman ${pageNum} dari ${pagesToProcess.length}...`
      );
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    // Tambahkan pemisah halaman jika bukan halaman pertama dan opsi pemisah aktif
    if (!isFirstPage && options.includePageBreaks) {
      documentChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    // 1. Jika mode VISUAL: langsung render halaman ke gambar beresolusi tinggi
    if (options.mode === 'visual') {
      const { buffer } = await renderPageToPngBuffer(page, 2.0);
      visualPagesCount++;

      // Skalakan lebar gambar agar pas dengan margin Word
      const targetWidth = Math.round(printableWidthPt);
      const targetHeight = Math.round(printableWidthPt / (viewport.width / viewport.height));

      documentChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: buffer,
              transformation: {
                width: targetWidth,
                height: targetHeight,
              },
              type: 'png',
            }),
          ],
        })
      );
      totalParagraphsCount++;
      continue;
    }

    // 2. Mode EDITABLE atau TEXT-ONLY: ekstrak teks dan struktur paragraf
    const textContent = await page.getTextContent();
    const rawItems: RawPdfItem[] = [];

    for (const item of textContent.items) {
      if ('str' in item && item.str.trim().length > 0) {
        const [scaleX, skewY, , , tx, ty] = item.transform;
        const fontSize = Math.round(Math.hypot(scaleX, skewY) || item.height || 11);
        const fontName = (item.fontName || '').toLowerCase();
        const isBold =
          fontName.includes('bold') ||
          fontName.includes('black') ||
          fontName.includes('heavy') ||
          fontName.includes('700') ||
          fontName.includes('800') ||
          fontName.includes('900');
        const isItalic =
          fontName.includes('italic') ||
          fontName.includes('oblique') ||
          fontName.includes('slant');

        rawItems.push({
          str: item.str,
          tx,
          ty,
          width: item.width,
          height: item.height,
          fontSize,
          isBold,
          isItalic,
        });
      }
    }

    const fullPageText = rawItems.map((i) => i.str).join(' ');
    const charCount = fullPageText.trim().length;

    // Jika mode EDITABLE dan halaman hampir tidak memiliki teks (< 20 karakter, hasil scan/gambar)
    if (options.mode === 'editable' && charCount < 20) {
      const { buffer } = await renderPageToPngBuffer(page, 2.0);
      visualPagesCount++;

      const targetWidth = Math.round(printableWidthPt);
      const targetHeight = Math.round(printableWidthPt / (viewport.width / viewport.height));

      documentChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: buffer,
              transformation: {
                width: targetWidth,
                height: targetHeight,
              },
              type: 'png',
            }),
          ],
        })
      );
      totalParagraphsCount++;
      continue;
    }

    // Rekonstruksi baris dan paragraf yang rapi
    const pageParagraphs = reconstructPageText(rawItems, viewport.width);

    if (pageParagraphs.length === 0) {
      // Halaman kosong: tambahkan paragraf kosong agar posisi halaman terjaga
      documentChildren.push(new Paragraph({ text: '' }));
      totalParagraphsCount++;
    } else {
      documentChildren.push(...pageParagraphs);
      totalParagraphsCount += pageParagraphs.length;
      totalWordsCount += fullPageText.trim().split(/\s+/).filter(Boolean).length;
    }
  }

  if (onProgress) {
    onProgress(
      pagesToProcess.length,
      pagesToProcess.length,
      'Menyusun dokumen OpenXML Microsoft Word (.docx)...'
    );
  }

  // Bangun dokumen Word menggunakan docx.Document
  const doc = new Document({
    title: options.outputName || stripPdfExtension(file.name),
    creator: 'Deyafa Arsetya ScorpioPDF',
    description: 'Dikonversi dari PDF secara aman & privat langsung di peramban.',
    sections: [
      {
        properties: {
          page: {
            size: {
              width: selectedSize.widthDxa,
              height: selectedSize.heightDxa,
            },
            margin: {
              top: marginDxa,
              right: marginDxa,
              bottom: marginDxa,
              left: marginDxa,
            },
          },
        },
        children: documentChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const outBaseName = options.outputName?.trim() || stripPdfExtension(file.name);
  const finalFileName = sanitizeDocxFilename(outBaseName);

  return {
    blob,
    fileName: finalFileName,
    pageCount: pagesToProcess.length,
    sizeBytes: blob.size,
    mode: options.mode,
    stats: {
      totalParagraphs: totalParagraphsCount,
      totalWords: totalWordsCount,
      visualPagesCount,
    },
  };
}
