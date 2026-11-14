import { degrees, PDFDocument } from 'pdf-lib';

export interface OrganizePageItem {
  id: string; // ID unik per kartu (untuk drag-and-drop & duplikasi)
  sourceFileIndex: number;
  sourcePageNum: number; // 1-indexed di dokumen sumber
  width: number;
  height: number;
  aspectRatio: number;
  thumbnailUrl: string;
  rotation: number; // Rotasi tambahan dalam derajat: 0, 90, 180, 270
  originalRotation: number; // Rotasi bawaan dokumen asli
}

export interface InspectOrganizePdfResult {
  file: File;
  fileName: string;
  fileSize: number;
  pageCount: number;
  pages: OrganizePageItem[];
}

export interface GeneratedOrganizeResult {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  pageCount: number;
  modifiedOrder: boolean;
  hasRotations: boolean;
}

// Inisialisasi pdfjs-dist secara aman di browser
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('Susun PDF hanya dapat dijalankan di browser.');
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

export function sanitizePdfFilename(name: string, fallback = 'dokumen-tersusun'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Menganalisis berkas PDF dan merender thumbnail seluruh halaman untuk penyusunan ulang
 */
export async function inspectPdfForOrganize(
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<InspectOrganizePdfResult> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages: OrganizePageItem[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    onProgress?.(pageNum, pageCount);
    const page = await pdfDoc.getPage(pageNum);
    const originalRotation = page.rotate || 0;
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
      id: `item-${pageNum}-${Math.random().toString(36).substring(2, 9)}`,
      sourceFileIndex: 0,
      sourcePageNum: pageNum,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      aspectRatio: viewport.width / viewport.height,
      thumbnailUrl,
      rotation: 0,
      originalRotation,
    });
  }

  return {
    file,
    fileName: file.name,
    fileSize: file.size,
    pageCount,
    pages,
  };
}

/**
 * Eksekusi penyusunan ulang dokumen PDF berdasarkan urutan kartu halaman dan rotasi
 */
export async function executeOrganizePdf(
  sourceFiles: File[],
  pages: OrganizePageItem[],
  outputName?: string,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<GeneratedOrganizeResult> {
  if (pages.length === 0) {
    throw new Error('Dokumen harus memiliki setidaknya 1 halaman untuk disimpan.');
  }

  onProgress?.(1, 4, 'Membaca dan memuat dokumen PDF sumber...');

  // Muat semua berkas sumber ke PDFDocument
  const loadedDocs: PDFDocument[] = [];
  for (let i = 0; i < sourceFiles.length; i++) {
    const ab = await sourceFiles[i].arrayBuffer();
    const doc = await PDFDocument.load(ab, { ignoreEncryption: true });
    loadedDocs.push(doc);
  }

  onProgress?.(2, 4, `Menyusun kembali ${pages.length} halaman sesuai urutan baru...`);

  const newDoc = await PDFDocument.create();

  let hasRotations = false;
  let modifiedOrder = false;

  for (let idx = 0; idx < pages.length; idx++) {
    const item = pages[idx];
    const srcDoc = loadedDocs[item.sourceFileIndex || 0];

    onProgress?.(
      2,
      4,
      `Menyalin dan memproses halaman ${idx + 1} dari ${pages.length}...`
    );

    const [copiedPage] = await newDoc.copyPages(srcDoc, [item.sourcePageNum - 1]);

    // Terapkan rotasi tambahan
    const totalRotation = ((item.originalRotation || 0) + (item.rotation || 0)) % 360;
    copiedPage.setRotation(degrees(totalRotation));

    if (item.rotation !== 0) {
      hasRotations = true;
    }

    if (idx !== item.sourcePageNum - 1) {
      modifiedOrder = true;
    }

    newDoc.addPage(copiedPage);
  }

  onProgress?.(3, 4, 'Menyalin informasi metadata dokumen...');
  if (loadedDocs[0]) {
    const title = loadedDocs[0].getTitle();
    const author = loadedDocs[0].getAuthor();
    if (title) newDoc.setTitle(title);
    if (author) newDoc.setAuthor(author);
  }
  newDoc.setProducer('Deyafa Arsetya ScorpioPDF Page Organizer Engine');
  newDoc.setCreator('ScorpioPDF (https://scorpio-pdf.local)');
  newDoc.setModificationDate(new Date());

  onProgress?.(4, 4, 'Menyusun berkas PDF akhir yang siap diunduh...');
  const pdfBytes = await newDoc.save({ useObjectStreams: true });
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const pdfBlob = new Blob([copy.buffer], { type: 'application/pdf' });

  const finalName = sanitizePdfFilename(
    outputName ? outputName : `${stripPdfExtension(sourceFiles[0]?.name || 'dokumen')}-tersusun`
  );

  return {
    blob: pdfBlob,
    fileName: finalName,
    sizeBytes: pdfBlob.size,
    pageCount: pages.length,
    modifiedOrder,
    hasRotations,
  };
}
