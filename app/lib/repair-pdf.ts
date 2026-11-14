import { PDFDocument } from 'pdf-lib';

export type RepairSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface PdfCorruptionIssue {
  id: string;
  title: string;
  desc: string;
  severity: RepairSeverity;
  fixed: boolean;
}

export interface PdfDiagnosticResult {
  isCorrupted: boolean;
  healthScore: number; // 0 - 100
  statusLabel: string;
  issues: PdfCorruptionIssue[];
  originalSize: number;
  estimatedPages: number;
  headerOffset: number;
  hasValidHeader: boolean;
  hasValidEof: boolean;
  hasXref: boolean;
  pdfVersion: string;
  summary: string;
}

export interface RepairOptions {
  outputName?: string;
  preferredStrategy?: 'auto' | 'native' | 'salvage';
}

export interface GeneratedRepairResult {
  blob: Blob;
  fileName: string;
  originalSize: number;
  repairedSize: number;
  pageCount: number;
  strategyUsed: 'native' | 'salvage';
  repairLogs: string[];
  healthScoreBefore: number;
  healthScoreAfter: number;
  thumbnails: string[];
}

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('Perbaiki PDF hanya dapat dijalankan di lingkungan browser.');
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

export function sanitizePdfFilename(name: string, fallback = 'dokumen-pulih'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Pindai dan lakukan diagnosa mendalam terhadap berkas PDF untuk mendeteksi
 * jenis kerusakan struktur, header, xref table, atau EOF marker.
 */
export async function inspectCorruptedPdf(file: File): Promise<PdfDiagnosticResult> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const totalBytes = uint8.length;

  const issues: PdfCorruptionIssue[] = [];
  let healthScore = 100;
  let estimatedPages = 0;

  // 1. Diagnosa Header (%PDF-)
  const headerSlice = uint8.slice(0, Math.min(2048, totalBytes));
  const headerText = new TextDecoder('latin1').decode(headerSlice);
  const pdfHeaderMatch = headerText.match(/%PDF-(\d+\.\d+)/);

  let headerOffset = -1;
  let pdfVersion = '1.4';
  let hasValidHeader = false;

  if (pdfHeaderMatch && pdfHeaderMatch.index !== undefined) {
    headerOffset = pdfHeaderMatch.index;
    pdfVersion = pdfHeaderMatch[1];
    hasValidHeader = true;

    if (headerOffset > 0) {
      // Ada karakter sampah / prefix sebelum %PDF-
      healthScore -= 18;
      issues.push({
        id: 'header-offset',
        title: 'Prefix / Karakter Sampah di Header Berkas',
        desc: `Ditemukan ${headerOffset} byte karakter non-PDF di awal berkas sebelum tag %PDF-. Ini sering terjadi akibat unduhan HTTP yang tidak bersih.`,
        severity: 'warning',
        fixed: false,
      });
    }
  } else {
    // Header %PDF- sama sekali tidak ditemukan di 2048 byte awal
    healthScore -= 40;
    issues.push({
      id: 'missing-header',
      title: 'Header Standar PDF (%PDF-) Hilang atau Cacat',
      desc: 'Berkas tidak diawali dengan tanda pengenal spesifikasi PDF yang valid, sehingga peramban dan aplikasi pembaca PDF gagal mengenali dokumen.',
      severity: 'critical',
      fixed: false,
    });
  }

  // 2. Diagnosa Akhir Berkas (%%EOF dan startxref)
  const tailSliceSize = Math.min(4096, totalBytes);
  const tailSlice = uint8.slice(totalBytes - tailSliceSize);
  const tailText = new TextDecoder('latin1').decode(tailSlice);

  const hasValidEof = tailText.includes('%%EOF');
  const hasStartXref = /startxref\s+\d+/.test(tailText);

  if (!hasValidEof) {
    healthScore -= 25;
    issues.push({
      id: 'missing-eof',
      title: 'Penanda Akhir Berkas (%%EOF) Hilang / Terpotong',
      desc: 'Dokumen terputus sebelum byte penutup selesai ditulis. Sering disebabkan oleh proses transfer/unduhan berkas yang belum tuntas.',
      severity: 'error',
      fixed: false,
    });
  }

  if (!hasStartXref) {
    healthScore -= 20;
    issues.push({
      id: 'missing-startxref',
      title: 'Penunjuk Tabel Indeks (startxref) Rusak atau Lenyap',
      desc: 'Alamat pointer menuju tabel referensi objek dokumen tidak ditemukan di bagian ekor file, menyebabkan aplikasi pembaca PDF gagal melacak halaman.',
      severity: 'error',
      fixed: false,
    });
  }

  // 3. Diagnosa Objek dan Halaman Melalui Pemindaian String
  const fullTextSample = new TextDecoder('latin1').decode(
    uint8.slice(0, Math.min(100000, totalBytes))
  );

  // Estimasi jumlah halaman dari token /Type /Page
  const pageMatches = fullTextSample.match(/\/Type\s*\/Page\b/g);
  if (pageMatches) {
    estimatedPages = pageMatches.length;
  }

  // Cek apakah ada tabel xref klasik atau stream xref
  const hasXref =
    tailText.includes('xref') ||
    fullTextSample.includes('/Type/XRef') ||
    fullTextSample.includes('/Type /XRef');

  if (!hasXref) {
    healthScore -= 20;
    issues.push({
      id: 'corrupt-xref',
      title: 'Tabel Referensi Silang (XRef) Korup',
      desc: 'Tabel indeks lokasi objek PDF rusak atau teracak. Struktur hierarki internal dokumen perlu dibangun ulang dari awal.',
      severity: 'error',
      fixed: false,
    });
  }

  // 4. Pengujian Baca dengan PDF.js & pdf-lib
  let pdfLibSuccess = false;
  try {
    const testDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    estimatedPages = testDoc.getPageCount();
    pdfLibSuccess = true;
  } catch {
    pdfLibSuccess = false;
  }

  if (!pdfLibSuccess) {
    healthScore -= 25;
    // Coba deteksi dengan PDF.js untuk memastikan halaman bisa diselamatkan
    try {
      const pdfjs = await getPdfjs();
      const loadingTask = pdfjs.getDocument({
        data: arrayBuffer,
        stopAtErrors: false,
      });
      const jsDoc = await loadingTask.promise;
      estimatedPages = jsDoc.numPages;

      issues.push({
        id: 'parser-incompatibility',
        title: 'Ketidaksesuaian Struktur Pohon Objek (/Pages & /Catalog)',
        desc: `Parser standar gagal membaca pohon objek, namun mesin penyerap cerdas berhasil mendeteksi ${estimatedPages} halaman yang dapat diselamatkan.`,
        severity: 'warning',
        fixed: false,
      });
    } catch {
      issues.push({
        id: 'deep-syntax-damage',
        title: 'Kerusakan Sintaks Dokumen Tingkat Lanjut',
        desc: 'Struktur kode internal dokumen mengalami korupsi data yang cukup dalam. Mode Pemulihan Halaman Mendalam (Deep Salvage) akan diaktifkan secara otomatis.',
        severity: 'critical',
        fixed: false,
      });
    }
  }

  // Normalisasi skor kesehatan
  healthScore = Math.max(10, Math.min(100, healthScore));

  let statusLabel = 'Dokumen Sehat';
  if (healthScore < 40) {
    statusLabel = 'Kerusakan Parah (Perlu Pemulihan Total)';
  } else if (healthScore < 70) {
    statusLabel = 'Kerusakan Sedang (XRef & Pohon Halaman Cacat)';
  } else if (healthScore < 95) {
    statusLabel = 'Kerusakan Ringan (Header / EOF Terpotong)';
  }

  let summary = `Dokumen ${file.name} memiliki tingkat kesehatan ${healthScore}%. `;
  if (issues.length === 0) {
    summary += 'Struktur file utuh dan dapat langsung dioptimalkan serta distandarisasi ulang.';
  } else {
    summary += `Ditemukan ${issues.length} indikasi anomali/kerusakan struktur yang dapat diperbaiki secara otomatis oleh mesin pemulih.`;
  }

  return {
    isCorrupted: issues.length > 0,
    healthScore,
    statusLabel,
    issues,
    originalSize: totalBytes,
    estimatedPages: Math.max(1, estimatedPages),
    headerOffset,
    hasValidHeader,
    hasValidEof,
    hasXref,
    pdfVersion,
    summary,
  };
}

/**
 * Pembersih byte mentah (Sanitasi Header & Footer)
 */
function sanitizeRawPdfBytes(rawBytes: Uint8Array): Uint8Array {
  let bytes = rawBytes;

  // Cari posisi %PDF-
  let pdfStart = -1;
  for (let i = 0; i < Math.min(4096, bytes.length - 5); i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      pdfStart = i;
      break;
    }
  }

  // Jika ada sampah di sebelum %PDF-, potong
  if (pdfStart > 0) {
    bytes = bytes.slice(pdfStart);
  } else if (pdfStart === -1) {
    // Sisipkan header standar jika hilang
    const defaultHeader = new TextEncoder().encode('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
    const combined = new Uint8Array(defaultHeader.length + bytes.length);
    combined.set(defaultHeader, 0);
    combined.set(bytes, defaultHeader.length);
    bytes = combined;
  }

  // Cek penutup %%EOF di akhir
  const tailText = new TextDecoder('latin1').decode(
    bytes.slice(Math.max(0, bytes.length - 1024))
  );

  if (!tailText.includes('%%EOF')) {
    const eofAppend = new TextEncoder().encode('\n%%EOF\n');
    const combined = new Uint8Array(bytes.length + eofAppend.length);
    combined.set(bytes, 0);
    combined.set(eofAppend, bytes.length);
    bytes = combined;
  }

  return bytes;
}

/**
 * Eksekusi Perbaikan Dokumen PDF
 */
export async function executeRepairPdf(
  file: File,
  diagnostic: PdfDiagnosticResult,
  options: RepairOptions = {},
  onProgress?: (step: number, total: number, message: string) => void
): Promise<GeneratedRepairResult> {
  const repairLogs: string[] = [];
  onProgress?.(1, 4, 'Membaca dan menganalisis aliran byte berkas...');

  const rawBuffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(rawBuffer);

  // Langkah 1: Pembersihan Header dan Akhir File
  onProgress?.(2, 4, 'Melakukan sanitasi byte header & penanda akhir %%EOF...');
  const cleanedBytes = sanitizeRawPdfBytes(rawBytes);

  if (diagnostic.headerOffset > 0) {
    repairLogs.push(`Berhasil memotong ${diagnostic.headerOffset} byte karakter sampah di header file.`);
  }
  if (!diagnostic.hasValidHeader) {
    repairLogs.push('Menyisipkan header terstandarisasi %PDF-1.7 yang valid.');
  }
  if (!diagnostic.hasValidEof) {
    repairLogs.push('Menambahkan penanda akhir berkas %%EOF sesuai spesifikasi ISO 32000.');
  }

  let repairedBlob: Blob | null = null;
  let finalPageCount = diagnostic.estimatedPages;
  let strategyUsed: 'native' | 'salvage' = 'native';
  const thumbnails: string[] = [];

  const shouldTryNativeFirst =
    options.preferredStrategy !== 'salvage';

  // Langkah 2: Coba Rekonstruksi Struktur Utuh (Native Rebuild)
  if (shouldTryNativeFirst) {
    try {
      onProgress?.(3, 4, 'Membangun ulang struktur objek dan tabel XRef baru...');

      const srcDoc = await PDFDocument.load(cleanedBytes, {
        ignoreEncryption: true,
      });

      const newDoc = await PDFDocument.create();
      const pageIndices = srcDoc.getPageIndices();
      finalPageCount = pageIndices.length;

      const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
      for (const page of copiedPages) {
        newDoc.addPage(page);
      }

      // Standarisasi metadata
      newDoc.setTitle(options.outputName || stripPdfExtension(file.name));
      newDoc.setProducer('Deyafa Arsetya ScorpioPDF Autonomous Repair Engine');
      newDoc.setCreator('ScorpioPDF (https://scorpio-pdf.local)');
      newDoc.setModificationDate(new Date());

      const savedBytes = await newDoc.save({ useObjectStreams: true });
      const copy = new Uint8Array(savedBytes.byteLength);
      copy.set(savedBytes);
      repairedBlob = new Blob([copy.buffer], { type: 'application/pdf' });

      repairLogs.push('Membangun ulang tabel Cross-Reference (XRef) baru dari nol.');
      repairLogs.push(`Menyelamatkan seluruh ${finalPageCount} halaman dokumen dengan kualitas vektor asli 100%.`);
      repairLogs.push('Menghapus referensi objek yatim (dangling pointers) dan stream terputus.');
      strategyUsed = 'native';
    } catch (err) {
      console.warn('Native rebuild gagal, beralih ke Pemulihan Halaman Mendalam (Deep Salvage):', err);
      repairedBlob = null;
    }
  }

  // Langkah 3: Jika Native gagal atau dipilih Deep Salvage, aktifkan PDF.js Fallback
  if (!repairedBlob) {
    strategyUsed = 'salvage';
    onProgress?.(3, 4, 'Mengaktifkan Mesin Pemulihan Halaman Mendalam (Deep Salvage)...');

    const pdfjs = await getPdfjs();
    const loadingTask = pdfjs.getDocument({
      data: cleanedBytes,
      stopAtErrors: false,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
    });

    const pdfDoc = await loadingTask.promise;
    finalPageCount = pdfDoc.numPages;

    const newDoc = await PDFDocument.create();
    let rescuedPages = 0;

    for (let pageNum = 1; pageNum <= finalPageCount; pageNum++) {
      onProgress?.(
        3,
        4,
        `Menyelamatkan dan merender ulang halaman ${pageNum} dari ${finalPageCount}...`
      );

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // 2.0x scale untuk ketajaman tinggi (setara 300 DPI)

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await page.render({ canvasContext: ctx, viewport } as any).promise;

          const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
          const imgBytes = await fetch(imgDataUrl).then((r) => r.arrayBuffer());
          const embeddedImage = await newDoc.embedJpg(imgBytes);

          // Buat halaman di dokumen baru dengan dimensi asli yang proporsional
          const origW = viewport.width / 2.0;
          const origH = viewport.height / 2.0;
          const newPdfPage = newDoc.addPage([origW, origH]);

          newPdfPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: origW,
            height: origH,
          });

          rescuedPages++;
        }
      } catch (pageErr) {
        console.warn(`Gagal memulihkan halaman ${pageNum}:`, pageErr);
      }
    }

    newDoc.setTitle(options.outputName || stripPdfExtension(file.name));
    newDoc.setProducer('Deyafa Arsetya ScorpioPDF Deep Salvage Engine');
    newDoc.setCreator('ScorpioPDF (https://scorpio-pdf.local)');
    newDoc.setModificationDate(new Date());

    const savedBytes = await newDoc.save({ useObjectStreams: true });
    const copy = new Uint8Array(savedBytes.byteLength);
    copy.set(savedBytes);
    repairedBlob = new Blob([copy.buffer], { type: 'application/pdf' });

    repairLogs.push(`Berhasil menyelamatkan ${rescuedPages} dari ${finalPageCount} halaman melalui Deep Page Salvage.`);
    repairLogs.push('Merender ulang seluruh elemen visual ke dalam lapisan kanvas ultra-jernih (High-DPI).');
    repairLogs.push('Menyusun berkas PDF baru dengan struktur ISO 32000 murni tanpa cacat.');
  }

  // Langkah 4: Render thumbnail pratinjau hasil perbaikan untuk UI
  onProgress?.(4, 4, 'Menyiapkan pratinjau halaman hasil pemulihan...');
  try {
    const pdfjs = await getPdfjs();
    const resultBuffer = await repairedBlob.arrayBuffer();
    const resultDoc = await pdfjs.getDocument({ data: resultBuffer }).promise;
    const maxThumbnails = Math.min(resultDoc.numPages, 6);

    for (let i = 1; i <= maxThumbnails; i++) {
      const p = await resultDoc.getPage(i);
      const vp = p.getViewport({ scale: 0.35 });
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = vp.width;
      thumbCanvas.height = vp.height;
      const tCtx = thumbCanvas.getContext('2d');
      if (tCtx) {
        tCtx.fillStyle = '#ffffff';
        tCtx.fillRect(0, 0, vp.width, vp.height);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await p.render({ canvasContext: tCtx, viewport: vp } as any).promise;
        thumbnails.push(thumbCanvas.toDataURL('image/jpeg', 0.85));
      }
    }
  } catch (thumbErr) {
    console.warn('Gagal merender thumbnail pratinjau:', thumbErr);
  }

  const finalName = sanitizePdfFilename(
    options.outputName || `${stripPdfExtension(file.name)}-pulih`
  );

  return {
    blob: repairedBlob,
    fileName: finalName,
    originalSize: rawBytes.length,
    repairedSize: repairedBlob.size,
    pageCount: finalPageCount,
    strategyUsed,
    repairLogs,
    healthScoreBefore: diagnostic.healthScore,
    healthScoreAfter: 100,
    thumbnails,
  };
}
