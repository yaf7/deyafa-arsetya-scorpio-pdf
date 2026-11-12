import JSZip from 'jszip';
import { PDFDocument, PDFImage } from 'pdf-lib';

export type PageOrientation = 'portrait' | 'landscape' | 'auto';
export type PageSizeOption = 'a4' | 'fit' | 'f4' | 'letter' | 'legal';
export type MarginOption = 'none' | 'small' | 'big';
export type ImageFitMode = 'contain' | 'cover';
export type QualityOption = 'original' | 'balanced' | 'compact';

export interface ImageItemInput {
  id: string;
  file: File;
  name: string;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface JpgToPdfOptions {
  orientation: PageOrientation;
  pageSize: PageSizeOption;
  margin: MarginOption;
  fitMode: ImageFitMode;
  quality: QualityOption;
  mergeAll: boolean;
  outputName: string;
}

export interface GeneratedPdfResult {
  kind: 'pdf' | 'zip';
  blob: Blob;
  fileName: string;
  pageCount: number;
  individualFiles?: { name: string; blob: Blob }[];
}

export const PAGE_DIMENSIONS_PT: Record<
  Exclude<PageSizeOption, 'fit'>,
  { width: number; height: number; label: string }
> = {
  a4: { width: 595.28, height: 841.89, label: 'A4 (210 × 297 mm)' },
  f4: { width: 609.45, height: 935.43, label: 'F4 / Folio (215 × 330 mm)' },
  letter: { width: 612, height: 792, label: 'Letter (215,9 × 279,4 mm)' },
  legal: { width: 612, height: 1008, label: 'Legal (215,9 × 355,6 mm)' },
};

export const MARGIN_PT: Record<MarginOption, number> = {
  none: 0,
  small: 34, // ~12 mm
  big: 70, // ~24.7 mm
};

export function isSupportedImageFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/png') {
    return true;
  }
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png')
  );
}

export function detectImageFormatLabel(file: File): 'JPG' | 'PNG' {
  const type = file.type.toLowerCase();
  const lower = file.name.toLowerCase();
  if (type === 'image/png' || lower.endsWith('.png')) {
    return 'PNG';
  }
  return 'JPG';
}

export async function readImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      });
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dims;
    } catch {
      // Fallback ke HTMLImageElement jika browser tidak mendukung opsi
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = {
        width: img.naturalWidth || 800,
        height: img.naturalHeight || 1000,
      };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Gagal membaca dimensi gambar: ${file.name}`));
    };
    img.src = url;
  });
}

function getJpegExifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return 1;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 4 < bytes.length) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    if (marker === 0xffe1) {
      if (offset + 8 >= bytes.length) break;
      const exifHeader = view.getUint32(offset + 2, false);
      if (exifHeader !== 0x45786966) return 1; // "Exif"
      const tiffOffset = offset + 8;
      if (tiffOffset + 8 >= bytes.length) return 1;
      const littleEndian = view.getUint16(tiffOffset, false) === 0x4949;
      const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);
      const dirStart = tiffOffset + ifdOffset;
      if (dirStart + 2 >= bytes.length) return 1;
      const entries = view.getUint16(dirStart, littleEndian);
      for (let i = 0; i < entries; i++) {
        const entryOffset = dirStart + 2 + i * 12;
        if (entryOffset + 12 > bytes.length) break;
        if (view.getUint16(entryOffset, littleEndian) === 0x0112) {
          return view.getUint16(entryOffset + 8, littleEndian);
        }
      }
      return 1;
    } else if ((marker & 0xff00) !== 0xff00) {
      break;
    } else {
      const length = view.getUint16(offset, false);
      offset += length;
    }
  }
  return 1;
}

async function decodeUprightBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, {
        imageOrientation: 'from-image',
      });
    } catch {
      // fallback below
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Tidak dapat memuat gambar ${file.name}`));
    };
    img.src = url;
  });
}

function getSourceDimensions(source: ImageBitmap | HTMLImageElement): {
  w: number;
  h: number;
} {
  if ('naturalWidth' in source) {
    return { w: source.naturalWidth, h: source.naturalHeight };
  }
  return { w: source.width, h: source.height };
}

async function renderNormalizedImageBytes(
  file: File,
  rotation: 0 | 90 | 180 | 270,
  quality: QualityOption,
  cropAspectRatio?: number
): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' }> {
  const source = await decodeUprightBitmap(file);
  try {
    const { w: srcW, h: srcH } = getSourceDimensions(source);

    // Langkah 1: Gambar ke canvas dengan rotasi user
    const rotatedW = rotation === 90 || rotation === 270 ? srcH : srcW;
    const rotatedH = rotation === 90 || rotation === 270 ? srcW : srcH;

    // Skala maksimal jika user memilih kompresi Ringkas / Seimbang
    let maxDim = Infinity;
    let jpegQuality = 0.94;
    if (quality === 'balanced') {
      maxDim = 2400;
      jpegQuality = 0.86;
    } else if (quality === 'compact') {
      maxDim = 1550;
      jpegQuality = 0.72;
    }

    const downscale =
      maxDim < Math.max(rotatedW, rotatedH)
        ? maxDim / Math.max(rotatedW, rotatedH)
        : 1;

    // Hitung crop bila mode Cover (Penuhi Halaman)
    let outW = Math.max(1, Math.round(rotatedW * downscale));
    let outH = Math.max(1, Math.round(rotatedH * downscale));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = outW;
    tempCanvas.height = outH;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) {
      throw new Error('Gagal menginisialisasi kanvas grafis.');
    }

    const isPng = detectImageFormatLabel(file) === 'PNG';
    // Isi latar putih agar area transparan PNG tampil bersih di atas kertas PDF
    tCtx.fillStyle = '#FFFFFF';
    tCtx.fillRect(0, 0, outW, outH);
    tCtx.imageSmoothingEnabled = true;
    tCtx.imageSmoothingQuality = 'high';

    tCtx.save();
    tCtx.translate(outW / 2, outH / 2);
    tCtx.rotate((rotation * Math.PI) / 180);
    const drawW = srcW * downscale;
    const drawH = srcH * downscale;
    tCtx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
    tCtx.restore();

    let finalCanvas = tempCanvas;

    if (cropAspectRatio && cropAspectRatio > 0) {
      const currentRatio = outW / outH;
      let sx = 0;
      let sy = 0;
      let sw = outW;
      let sh = outH;

      if (currentRatio > cropAspectRatio) {
        sw = Math.max(1, Math.round(outH * cropAspectRatio));
        sx = Math.round((outW - sw) / 2);
      } else if (currentRatio < cropAspectRatio) {
        sh = Math.max(1, Math.round(outW / cropAspectRatio));
        sy = Math.round((outH - sh) / 2);
      }

      if (sw !== outW || sh !== outH) {
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = sw;
        cropCanvas.height = sh;
        const cCtx = cropCanvas.getContext('2d');
        if (cCtx) {
          cCtx.fillStyle = '#FFFFFF';
          cCtx.fillRect(0, 0, sw, sh);
          cCtx.drawImage(tempCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
          finalCanvas = cropCanvas;
          outW = sw;
          outH = sh;
        }
      }
    }

    const exportAsPng = isPng && quality === 'original';
    const mime = exportAsPng ? 'image/png' : 'image/jpeg';

    const blob: Blob = await new Promise((resolve, reject) => {
      finalCanvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error(`Gagal memproses gambar ${file.name}`));
        },
        mime,
        exportAsPng ? undefined : jpegQuality
      );
    });

    const buffer = await blob.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      kind: exportAsPng ? 'png' : 'jpg',
    };
  } finally {
    if ('close' in source && typeof source.close === 'function') {
      source.close();
    }
  }
}

function resolvePageMetrics(
  imgWidth: number,
  imgHeight: number,
  rotation: 0 | 90 | 180 | 270,
  options: JpgToPdfOptions
): { pageWidth: number; pageHeight: number; marginPt: number } {
  const effectiveW = rotation === 90 || rotation === 270 ? imgHeight : imgWidth;
  const effectiveH = rotation === 90 || rotation === 270 ? imgWidth : imgHeight;
  const marginPt = MARGIN_PT[options.margin];

  if (options.pageSize === 'fit') {
    // Konversi piksel ke poin PDF (72/96 = 0.75) dengan batas aman PDF <= 4000pt
    let ptW = effectiveW * 0.75;
    let ptH = effectiveH * 0.75;
    const maxPt = 3600;
    if (Math.max(ptW, ptH) > maxPt) {
      const scale = maxPt / Math.max(ptW, ptH);
      ptW *= scale;
      ptH *= scale;
    }
    return {
      pageWidth: Math.max(72, ptW) + marginPt * 2,
      pageHeight: Math.max(72, ptH) + marginPt * 2,
      marginPt,
    };
  }

  const base = PAGE_DIMENSIONS_PT[options.pageSize];
  const isImageLandscape = effectiveW > effectiveH;

  const useLandscape =
    options.orientation === 'landscape' ||
    (options.orientation === 'auto' && isImageLandscape);

  return {
    pageWidth: useLandscape ? base.height : base.width,
    pageHeight: useLandscape ? base.width : base.height,
    marginPt,
  };
}

async function addImagePageToDoc(
  pdfDoc: PDFDocument,
  item: ImageItemInput,
  options: JpgToPdfOptions
) {
  const { pageWidth, pageHeight, marginPt } = resolvePageMetrics(
    item.width,
    item.height,
    item.rotation,
    options
  );

  const availW = Math.max(10, pageWidth - marginPt * 2);
  const availH = Math.max(10, pageHeight - marginPt * 2);
  const isCover = options.pageSize !== 'fit' && options.fitMode === 'cover';
  const targetRatio = isCover ? availW / availH : undefined;

  let embedded: PDFImage | null = null;
  const isPng = detectImageFormatLabel(item.file) === 'PNG';

  // Jalur cepat lossless bila kualitas Asli, rotasi 0, bukan Cover crop, dan EXIF normal
  if (
    options.quality === 'original' &&
    item.rotation === 0 &&
    !isCover
  ) {
    try {
      const rawBuffer = await item.file.arrayBuffer();
      const rawBytes = new Uint8Array(rawBuffer);
      if (isPng) {
        embedded = await pdfDoc.embedPng(rawBytes);
      } else if (getJpegExifOrientation(rawBytes) === 1) {
        embedded = await pdfDoc.embedJpg(rawBytes);
      }
    } catch {
      embedded = null;
    }
  }

  if (!embedded) {
    const normalized = await renderNormalizedImageBytes(
      item.file,
      item.rotation,
      options.quality,
      targetRatio
    );
    embedded =
      normalized.kind === 'png'
        ? await pdfDoc.embedPng(normalized.bytes)
        : await pdfDoc.embedJpg(normalized.bytes);
  }

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const imgDims = embedded.scale(1);

  const scale = isCover
    ? Math.max(availW / imgDims.width, availH / imgDims.height)
    : Math.min(availW / imgDims.width, availH / imgDims.height);

  const drawW = imgDims.width * scale;
  const drawH = imgDims.height * scale;
  const x = marginPt + (availW - drawW) / 2;
  const y = marginPt + (availH - drawH) / 2;

  page.drawImage(embedded, {
    x,
    y,
    width: drawW,
    height: drawH,
  });
}

function sanitizePdfFilename(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\.pdf$/i, '');
  return (cleaned || fallback) + '.pdf';
}

function stripExtension(name: string): string {
  return name.replace(/\.(jpe?g|png)$/i, '');
}

export async function convertImagesToPdf(
  items: ImageItemInput[],
  options: JpgToPdfOptions,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<GeneratedPdfResult> {
  if (items.length === 0) {
    throw new Error('Pilih minimal satu gambar JPG atau PNG terlebih dahulu.');
  }

  // Mode 1: Gabungkan semua gambar dalam satu file PDF (atau hanya 1 gambar)
  if (options.mergeAll || items.length === 1) {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setCreator('Deyafa Arsetya ScorpioPDF');
    pdfDoc.setProducer('Deyafa Arsetya ScorpioPDF');

    for (let i = 0; i < items.length; i++) {
      onProgress?.(i + 1, items.length, items[i].name);
      await addImagePageToDoc(pdfDoc, items[i], options);
      // Beri jeda micro-tick agar UI progress tetap responsif pada jumlah gambar banyak
      await new Promise((r) => setTimeout(r, 0));
    }

    const pdfBytes = await pdfDoc.save();
    const copy = new Uint8Array(pdfBytes.byteLength);
    copy.set(pdfBytes);
    const blob = new Blob([copy.buffer], { type: 'application/pdf' });

    const defaultName =
      items.length === 1
        ? stripExtension(items[0].name)
        : 'ScorpioPDF-Gambar';

    return {
      kind: 'pdf',
      blob,
      fileName: sanitizePdfFilename(options.outputName, defaultName),
      pageCount: items.length,
    };
  }

  // Mode 2: Setiap gambar menjadi PDF terpisah, dikemas dalam file ZIP
  const zip = new JSZip();
  const individualFiles: { name: string; blob: Blob }[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i + 1, items.length, item.name);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setCreator('Deyafa Arsetya ScorpioPDF');
    pdfDoc.setProducer('Deyafa Arsetya ScorpioPDF');
    await addImagePageToDoc(pdfDoc, item, options);

    const pdfBytes = await pdfDoc.save();
    const copy = new Uint8Array(pdfBytes.byteLength);
    copy.set(pdfBytes);
    const pdfBlob = new Blob([copy.buffer], { type: 'application/pdf' });

    const base = stripExtension(item.name) || `gambar-${i + 1}`;
    let candidate = `${base}.pdf`;
    let suffix = 2;
    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${base}-${suffix}.pdf`;
      suffix++;
    }
    usedNames.add(candidate.toLowerCase());

    zip.file(candidate, copy);
    individualFiles.push({ name: candidate, blob: pdfBlob });

    await new Promise((r) => setTimeout(r, 0));
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipBase =
    options.outputName
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\.(pdf|zip)$/i, '') || 'ScorpioPDF-Gambar-Terpisah';

  return {
    kind: 'zip',
    blob: zipBlob,
    fileName: `${zipBase}.zip`,
    pageCount: items.length,
    individualFiles,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
}
