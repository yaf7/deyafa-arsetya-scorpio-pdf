export type SlideLayoutOption = '16x9' | '4x3' | 'auto';

export const SLIDE_LAYOUT_CONFIG: Record<
  SlideLayoutOption,
  { label: string; widthInches: number; heightInches: number; desc: string }
> = {
  '16x9': {
    label: 'Layar Lebar 16:9 (Rekomendasi)',
    widthInches: 13.333,
    heightInches: 7.5,
    desc: 'Format standar proyektor, monitor, dan presentasi modern (Full HD)',
  },
  '4x3': {
    label: 'Standar 4:3 (Klasik)',
    widthInches: 10.0,
    heightInches: 7.5,
    desc: 'Format layar tradisional atau dokumen vertikal',
  },
  auto: {
    label: 'Otomatis Sesuai PDF',
    widthInches: 13.333,
    heightInches: 7.5,
    desc: 'Mendeteksi rasio tiap halaman PDF secara otomatis',
  },
};

export type PdfToPptxMode = 'editable' | 'visual' | 'hybrid';

export const PDF_TO_PPTX_MODES: Record<
  PdfToPptxMode,
  { label: string; tag: string; desc: string }
> = {
  editable: {
    label: 'Teks & Elemen Diedit (Rekomendasi)',
    tag: 'Bisa Diedit',
    desc: 'Mengekstrak judul, paragraf, dan daftar menjadi kotak teks yang dapat langsung diedit di PowerPoint, serta mencadangkan gambar scan otomatis.',
  },
  visual: {
    label: 'Tata Letak Visual Utuh (100% Persis Desain)',
    tag: '100% Persis',
    desc: 'Merender setiap halaman PDF menjadi grafis slide beresolusi tajam (Full HD / 4K). Ideal untuk infografis, sertifikat, atau ekspor Canva/Figma.',
  },
  hybrid: {
    label: 'Hibrida Cerdas (Visual Penuh + Teks Diedit)',
    tag: 'Teks + Visual',
    desc: 'Mempertahankan tampilan grafis 100% persis seperti PDF asli sekaligus menumpangkan teks yang dapat diedit dan disalin di atasnya.',
  },
};

export type PptxQuality = 'high' | 'ultra' | 'standard';

export const PPTX_QUALITIES: Record<
  PptxQuality,
  { label: string; scale: number; jpegQuality: number; desc: string }
> = {
  high: {
    label: 'Tinggi — 1080p Full HD (Rekomendasi)',
    scale: 2.0,
    jpegQuality: 0.92,
    desc: 'Kualitas grafis tajam, rendering cepat & seimbang',
  },
  ultra: {
    label: 'Ultra HD — 4K (Siap Presentasi Besar)',
    scale: 3.0,
    jpegQuality: 0.96,
    desc: 'Detail grafis maksimal untuk layar proyektor besar',
  },
  standard: {
    label: 'Standar — 720p (Ringan & Hemat Ukuran)',
    scale: 1.333,
    jpegQuality: 0.85,
    desc: 'Ukuran file presentasi lebih kecil untuk dibagikan via email',
  },
};

export interface PdfSlideSummary {
  pageNumber: number; // 1-indexed
  widthPt: number;
  heightPt: number;
  aspectRatio: number;
  thumbnailUrl: string;
  hasText: boolean;
  charCount: number;
  snippet: string;
  isWidescreen: boolean;
}

export interface ManagedPdfPresentation {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  slides: PdfSlideSummary[];
  defaultAspect: '16x9' | '4x3';
}

export interface PdfToPowerpointOptions {
  mode: PdfToPptxMode;
  layout: SlideLayoutOption;
  quality: PptxQuality;
  selectedPages: number[]; // 1-indexed
  outputName?: string;
}

export interface GeneratedPptxResult {
  blob: Blob;
  fileName: string;
  slideCount: number;
  sizeBytes: number;
  mode: PdfToPptxMode;
}

// Inisialisasi aman pdfjs-dist di browser
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF to PowerPoint hanya dapat dijalankan di browser.');
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

export function sanitizePptxFilename(name: string, fallback = 'presentasi-powerpoint'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pptx') ? base : `${base}.pptx`;
}

/**
 * Muat file PDF, buat thumbnail tiap halaman dan hitung rasio slide
 */
export async function inspectPdfForPptx(
  file: File,
  onThumbnailReady?: (pageNumber: number, summary: PdfSlideSummary) => void
): Promise<ManagedPdfPresentation> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const slides: PdfSlideSummary[] = [];

  let widescreenCount = 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    const widthPt = Math.round(viewport.width);
    const heightPt = Math.round(viewport.height);
    const aspectRatio = widthPt / heightPt;
    const isWidescreen = aspectRatio >= 1.5;
    if (isWidescreen) widescreenCount++;

    // 1. Ekstrak teks cepat
    let charCount = 0;
    let snippet = '';
    try {
      const textContent = await page.getTextContent();
      const rawText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ');
      charCount = rawText.trim().length;
      snippet = rawText.trim().replace(/\s+/g, ' ').slice(0, 150);
    } catch {
      charCount = 0;
      snippet = '';
    }

    // 2. Buat thumbnail visual cepat
    let thumbUrl = '';
    try {
      const thumbScale = Math.min(0.4, 300 / Math.max(viewport.width, viewport.height));
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

    const summary: PdfSlideSummary = {
      pageNumber: pageNum,
      widthPt,
      heightPt,
      aspectRatio,
      thumbnailUrl: thumbUrl,
      hasText: charCount >= 20,
      charCount,
      snippet,
      isWidescreen,
    };

    slides.push(summary);
    onThumbnailReady?.(pageNum, summary);
  }

  const defaultAspect: '16x9' | '4x3' =
    widescreenCount >= pageCount / 2 ? '16x9' : '4x3';

  return {
    id: `pptx-pres-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    name: file.name,
    size: file.size,
    pageCount,
    slides,
    defaultAspect,
  };
}

interface RawTextItem {
  str: string;
  tx: number;
  ty: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
}

interface TextBlock {
  items: RawTextItem[];
  text: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  maxFontSize: number;
  isHeading: boolean;
  isBullet: boolean;
  alignment: 'left' | 'center' | 'right';
}

/**
 * Kelompokkan item teks halaman PDF menjadi blok-blok teks presentasi
 */
function clusterTextIntoBlocks(
  items: RawTextItem[],
  pageWidthPt: number,
  pageHeightPt: number
): TextBlock[] {
  if (items.length === 0) return [];

  // Urutkan item dari atas ke bawah
  const sorted = [...items].sort((a, b) => {
    // Ingat di PDF ty dihitung dari bawah ke atas
    const topA = pageHeightPt - a.ty;
    const topB = pageHeightPt - b.ty;
    if (Math.abs(topA - topB) > 4) {
      return topA - topB;
    }
    return a.tx - b.tx;
  });

  // Kelompokkan menjadi baris
  const lines: RawTextItem[][] = [];
  let currentLine: RawTextItem[] = [];
  let currentY = sorted[0].ty;

  for (const item of sorted) {
    if (currentLine.length === 0) {
      currentLine.push(item);
      currentY = item.ty;
    } else if (Math.abs(item.ty - currentY) <= 4) {
      currentLine.push(item);
    } else {
      currentLine.sort((a, b) => a.tx - b.tx);
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.ty;
    }
  }
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.tx - b.tx);
    lines.push(currentLine);
  }

  // Gabungkan baris-baris berdekatan menjadi TextBlock
  const blocks: TextBlock[] = [];
  let currentBlockLines: RawTextItem[][] = [];

  const flushBlock = () => {
    if (currentBlockLines.length === 0) return;

    const allItems = currentBlockLines.flat();
    const fullText = allItems.map((i) => i.str).join(' ').trim();

    const minX = Math.min(...allItems.map((i) => i.tx));
    const maxX = Math.max(...allItems.map((i) => i.tx + i.width));
    // Konversi koordinat Y dari bawah-ke-atas PDF menjadi atas-ke-bawah slide
    const minY = Math.min(...allItems.map((i) => pageHeightPt - i.ty - i.height));
    const maxY = Math.max(...allItems.map((i) => pageHeightPt - i.ty));
    const maxFontSize = Math.max(...allItems.map((i) => i.fontSize), 12);

    const isHeading = maxFontSize >= 18;
    const isBullet = /^[•\-\*\u2022]\s+/.test(fullText) || /^\d+[\.\)]\s+/.test(fullText);

    const centerX = (minX + maxX) / 2;
    const pageCenterX = pageWidthPt / 2;
    let alignment: 'left' | 'center' | 'right' = 'left';
    if (Math.abs(centerX - pageCenterX) < 30 && maxX - minX < pageWidthPt * 0.7) {
      alignment = 'center';
    } else if (minX > pageWidthPt * 0.55) {
      alignment = 'right';
    }

    blocks.push({
      items: allItems,
      text: fullText,
      minX,
      maxX,
      minY,
      maxY,
      maxFontSize,
      isHeading,
      isBullet,
      alignment,
    });

    currentBlockLines = [];
  };

  for (const line of lines) {
    if (currentBlockLines.length === 0) {
      currentBlockLines.push(line);
      continue;
    }

    const prevLine = currentBlockLines[currentBlockLines.length - 1];
    const prevY = prevLine[0].ty;
    const thisY = line[0].ty;
    const gap = prevY - thisY; // Jarak vertikal
    const maxFont = Math.max(...prevLine.map((i) => i.fontSize));

    if (gap > maxFont * 2.2 || line.some((i) => i.fontSize >= 18)) {
      flushBlock();
      currentBlockLines.push(line);
    } else {
      currentBlockLines.push(line);
    }
  }

  flushBlock();
  return blocks;
}

/**
 * Konversi PDF ke PowerPoint (.pptx)
 */
export async function convertPdfToPowerpoint(
  file: File,
  options: PdfToPowerpointOptions,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<GeneratedPptxResult> {
  const pdfjs = await getPdfjs();
  const pptxgenModule = await import('pptxgenjs');
  const PptxGenJS = pptxgenModule.default;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  const pagesToProcess = (
    options.selectedPages.length > 0
      ? options.selectedPages
      : Array.from({ length: totalPages }, (_, i) => i + 1)
  )
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);

  if (pagesToProcess.length === 0) {
    throw new Error('Pilih minimal satu halaman PDF untuk dikonversi.');
  }

  const qualityConfig = PPTX_QUALITIES[options.quality] || PPTX_QUALITIES.high;

  // Inisialisasi presentasi PowerPoint
  const pres = new PptxGenJS();
  pres.title = options.outputName || stripPdfExtension(file.name);
  pres.author = 'Deyafa Arsetya ScorpioPDF';
  pres.company = 'Deyafa Arsetya ScorpioPDF';

  // Tentukan layout slide
  if (options.layout === '4x3') {
    pres.layout = 'LAYOUT_4x3';
  } else {
    // 16:9 Modern Widescreen
    pres.layout = 'LAYOUT_WIDE';
  }

  const slideWidthInches = options.layout === '4x3' ? 10.0 : 13.333;
  const slideHeightInches = 7.5;

  for (let i = 0; i < pagesToProcess.length; i++) {
    const pageNum = pagesToProcess[i];
    onProgress?.(
      i + 1,
      pagesToProcess.length,
      `Memproses slide ${i + 1} dari ${pagesToProcess.length}...`
    );

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    const slide = pres.addSlide();

    // 1. Jika mode VISUAL atau HYBRID: Render halaman ke JPEG resolusi tinggi
    if (options.mode === 'visual' || options.mode === 'hybrid') {
      const renderViewport = page.getViewport({ scale: qualityConfig.scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(renderViewport.width));
      canvas.height = Math.max(1, Math.round(renderViewport.height));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport: renderViewport,
        }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', qualityConfig.jpegQuality);
        slide.addImage({
          data: dataUrl,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
        });
      }
    }

    // 2. Jika mode EDITABLE atau HYBRID: Ekstrak teks dan buat Text Box
    if (options.mode === 'editable' || options.mode === 'hybrid') {
      const textContent = await page.getTextContent();
      const rawItems: RawTextItem[] = [];

      for (const item of textContent.items) {
        if ('str' in item && item.str.trim().length > 0) {
          const [scaleX, skewY, , , tx, ty] = item.transform;
          const fontSize = Math.round(Math.hypot(scaleX, skewY) || item.height || 12);
          const fontName = (item.fontName || '').toLowerCase();
          const isBold =
            fontName.includes('bold') ||
            fontName.includes('black') ||
            fontName.includes('700') ||
            fontName.includes('800');
          const isItalic =
            fontName.includes('italic') || fontName.includes('oblique');

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

      const totalChars = rawItems.reduce((acc, item) => acc + item.str.length, 0);

      // Jika mode EDITABLE dan halaman berupa hasil scan (< 20 karakter teks), render gambar otomatis
      if (options.mode === 'editable' && totalChars < 20) {
        const renderViewport = page.getViewport({ scale: qualityConfig.scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(renderViewport.width));
        canvas.height = Math.max(1, Math.round(renderViewport.height));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({
            canvas,
            canvasContext: ctx,
            viewport: renderViewport,
          }).promise;
          const dataUrl = canvas.toDataURL('image/jpeg', qualityConfig.jpegQuality);
          slide.addImage({
            data: dataUrl,
            x: 0,
            y: 0,
            w: '100%',
            h: '100%',
          });
        }
      } else {
        // Kelompokkan menjadi blok teks
        const blocks = clusterTextIntoBlocks(rawItems, viewport.width, viewport.height);

        for (const block of blocks) {
          // Petakan koordinat points ke satuan inci slide
          const xInches = Math.max(
            0,
            Math.min(
              slideWidthInches - 0.5,
              (block.minX / viewport.width) * slideWidthInches
            )
          );
          const yInches = Math.max(
            0,
            Math.min(
              slideHeightInches - 0.5,
              (block.minY / viewport.height) * slideHeightInches
            )
          );
          const wInches = Math.max(
            1.0,
            Math.min(
              slideWidthInches - xInches,
              ((block.maxX - block.minX) / viewport.width) * slideWidthInches + 0.3
            )
          );
          const hInches = Math.max(
            0.4,
            Math.min(
              slideHeightInches - yInches,
              ((block.maxY - block.minY) / viewport.height) * slideHeightInches + 0.2
            )
          );

          // Skala ukuran font disesuaikan dengan dimensi slide
          const fontPt = Math.max(
            10,
            Math.min(48, Math.round((block.maxFontSize / viewport.height) * slideHeightInches * 72))
          );

          slide.addText(block.text, {
            x: xInches,
            y: yInches,
            w: wInches,
            h: hInches,
            fontSize: fontPt,
            bold: block.isHeading || block.items.some((i) => i.isBold),
            color: block.isHeading ? '0F172A' : '334155',
            align: block.alignment,
            valign: 'top',
            isTextBox: true,
            bullet: block.isBullet ? true : false,
          });
        }
      }
    }
  }

  onProgress?.(
    pagesToProcess.length,
    pagesToProcess.length,
    'Menyusun file presentasi PowerPoint (.pptx)...'
  );

  const blob = (await pres.write({ outputType: 'blob' })) as Blob;
  const outName = options.outputName?.trim() || stripPdfExtension(file.name);
  const finalFileName = sanitizePptxFilename(outName);

  return {
    blob,
    fileName: finalFileName,
    slideCount: pagesToProcess.length,
    sizeBytes: blob.size,
    mode: options.mode,
  };
}

