import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';

export type ExcelPageSize = 'a4' | 'f4' | 'letter';

export const EXCEL_PAGE_SIZES: Record<
  ExcelPageSize,
  { label: string; widthPt: number; heightPt: number; desc: string }
> = {
  a4: {
    label: 'A4 (210 × 297 mm)',
    widthPt: 595.28,
    heightPt: 841.89,
    desc: 'Standar dokumen cetak Indonesia & internasional',
  },
  f4: {
    label: 'F4 / Folio (215 × 330 mm)',
    widthPt: 609.45,
    heightPt: 935.43,
    desc: 'Standar kertas kedinasan, perkantoran & legal Indonesia',
  },
  letter: {
    label: 'US Letter (216 × 279 mm)',
    widthPt: 612.0,
    heightPt: 792.0,
    desc: 'Standar dokumen Amerika Serikat',
  },
};

export type ExcelOrientation = 'landscape' | 'portrait';

export const EXCEL_ORIENTATIONS: Record<
  ExcelOrientation,
  { label: string; desc: string }
> = {
  landscape: {
    label: 'Mendatar / Lanskap (Rekomendasi)',
    desc: 'Memberikan ruang horizontal luas agar kolom tabel muat rapi',
  },
  portrait: {
    label: 'Tegak / Potret',
    desc: 'Format vertikal cocok untuk tabel dengan sedikit kolom',
  },
};

export type ExcelFitMode = 'fit-width' | 'fit-page' | 'actual';

export const EXCEL_FIT_MODES: Record<
  ExcelFitMode,
  { label: string; tag: string; desc: string }
> = {
  'fit-width': {
    label: 'Pas Lebar Halaman (Fit Width)',
    tag: 'Rekomendasi',
    desc: 'Menyesuaikan proporsi tabel agar semua kolom muat dalam 1 lebar lembar tanpa terpotong',
  },
  'fit-page': {
    label: 'Pas 1 Lembar Utuh (Fit to 1 Page)',
    tag: '1 Halaman',
    desc: 'Memampatkan seluruh data sheet ke dalam tepat satu lembar halaman PDF',
  },
  actual: {
    label: 'Ukuran Asli 100%',
    tag: 'Tanpa Skala',
    desc: 'Mempertahankan ukuran font standar 100% sesuai rasio asli',
  },
};

export type ExcelTheme = 'emerald' | 'slate' | 'blue';

export const EXCEL_THEMES: Record<
  ExcelTheme,
  { label: string; headerBg: string; headerText: string; border: string; accent: string }
> = {
  emerald: {
    label: 'Hijau Excel Klasik',
    headerBg: '#059669',
    headerText: '#FFFFFF',
    border: '#D1FAE5',
    accent: '#10B981',
  },
  slate: {
    label: 'Abu-Abu Profesional',
    headerBg: '#334155',
    headerText: '#FFFFFF',
    border: '#E2E8F0',
    accent: '#64748B',
  },
  blue: {
    label: 'Biru Korporat',
    headerBg: '#2563EB',
    headerText: '#FFFFFF',
    border: '#DBEAFE',
    accent: '#3B82F6',
  },
};

export interface SheetSummary {
  name: string;
  index: number;
  rowCount: number;
  colCount: number;
  range: string;
  rows: (string | number | boolean | null)[][];
  previewRows: (string | number | boolean | null)[][];
}

export interface ManagedExcelFile {
  id: string;
  file: File;
  name: string;
  size: number;
  sheets: SheetSummary[];
  totalRows: number;
}

export interface ExcelToPdfOptions {
  pageSize: ExcelPageSize;
  orientation: ExcelOrientation;
  fitMode: ExcelFitMode;
  showGridlines: boolean;
  stripedRows: boolean;
  repeatHeader: boolean;
  theme: ExcelTheme;
  selectedSheets: string[]; // sheet names
  outputName?: string;
}

export interface GeneratedExcelPdfResult {
  blob: Blob;
  fileName: string;
  pageCount: number;
  sheetCount: number;
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

export function stripExcelExtension(fileName: string): string {
  return fileName.replace(/\.(xlsx|xls|csv|ods)$/i, '');
}

export function sanitizePdfFilename(name: string, fallback = 'dokumen-excel'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Muat file Excel dan ekstrak informasi sheet, jumlah baris, serta preview data
 */
export async function inspectExcelWorkbook(
  file: File
): Promise<ManagedExcelFile> {
  const arrayBuffer = await file.arrayBuffer();

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: true,
      cellStyles: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Gagal membuka file Excel: ${msg}`);
  }

  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('File spreadsheet tidak memiliki lembar kerja (sheet) aktif.');
  }

  let grandTotalRows = 0;
  const sheets: SheetSummary[] = [];

  for (let idx = 0; idx < sheetNames.length; idx++) {
    const name = sheetNames[idx];
    const ws = workbook.Sheets[name];
    if (!ws) continue;

    // Ambil data dalam bentuk matriks 2D baris x kolom
    const rawRows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
      ws,
      {
        header: 1,
        defval: '',
        blankrows: false,
      }
    );

    // Filter baris kosong sepenuhnya di akhir
    const cleanedRows = rawRows.filter((r) =>
      Array.isArray(r) && r.some((c) => c !== null && String(c).trim() !== '')
    );

    const rowCount = cleanedRows.length;
    const colCount = cleanedRows.reduce((max, r) => Math.max(max, r.length), 0);
    grandTotalRows += rowCount;

    sheets.push({
      name,
      index: idx,
      rowCount,
      colCount,
      range: ws['!ref'] || (rowCount > 0 ? `A1:Z${rowCount}` : 'A1:A1'),
      rows: cleanedRows,
      previewRows: cleanedRows.slice(0, 10),
    });
  }

  return {
    id: `excel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    name: file.name,
    size: file.size,
    sheets,
    totalRows: grandTotalRows,
  };
}

/**
 * Format sel tabel Excel agar rapi (angka rata kanan, teks rata kiri)
 */
function formatCellValue(val: unknown): { text: string; isNumber: boolean } {
  if (val === null || val === undefined || val === '') {
    return { text: '', isNumber: false };
  }

  if (typeof val === 'number') {
    // Jika integer besar (misal gaji atau ID) atau desimal
    const isInt = Number.isInteger(val);
    const formatted = isInt
      ? val.toLocaleString('id-ID')
      : val.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    return { text: formatted, isNumber: true };
  }

  if (val instanceof Date) {
    return {
      text: val.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      isNumber: false,
    };
  }

  return { text: String(val).trim(), isNumber: false };
}

/**
 * Hitung dimensi kertas PDF dalam points
 */
function getPageDimensionsPt(
  size: ExcelPageSize,
  orientation: ExcelOrientation
): { widthPt: number; heightPt: number } {
  const base = EXCEL_PAGE_SIZES[size] || EXCEL_PAGE_SIZES.a4;
  if (orientation === 'landscape') {
    return {
      widthPt: Math.max(base.widthPt, base.heightPt),
      heightPt: Math.min(base.widthPt, base.heightPt),
    };
  }
  return {
    widthPt: Math.min(base.widthPt, base.heightPt),
    heightPt: Math.max(base.widthPt, base.heightPt),
  };
}

/**
 * Konversi Excel ke Dokumen PDF melalui DOM HTML & html2canvas
 */
export async function convertExcelToPdf(
  managed: ManagedExcelFile,
  options: ExcelToPdfOptions,
  onProgress?: (current: number, total: number) => void
): Promise<GeneratedExcelPdfResult> {
  const html2canvasModule = await import('html2canvas');
  const html2canvas = html2canvasModule.default || html2canvasModule;

  const { widthPt, heightPt } = getPageDimensionsPt(
    options.pageSize,
    options.orientation
  );

  const sheetsToProcess = managed.sheets.filter((s) =>
    options.selectedSheets.includes(s.name)
  );

  if (sheetsToProcess.length === 0) {
    throw new Error('Pilih minimal satu lembar kerja (sheet) untuk dikonversi.');
  }

  const themeConfig = EXCEL_THEMES[options.theme] || EXCEL_THEMES.emerald;

  // Rasio points ke pixels render (~96 dpi / 72 pt = 1.333)
  const pagePxWidth = Math.round(widthPt * 1.333);
  const pagePxHeight = Math.round(heightPt * 1.333);

  // Buat container isolasi sementara di DOM yang tidak terlihat di layar
  const mountContainer = document.createElement('div');
  mountContainer.style.position = 'fixed';
  mountContainer.style.left = '-9999px';
  mountContainer.style.top = '0';
  mountContainer.style.zIndex = '-100';
  mountContainer.style.opacity = '0';
  mountContainer.style.pointerEvents = 'none';
  document.body.appendChild(mountContainer);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(options.outputName || stripExcelExtension(managed.name));
  pdfDoc.setCreator('Deyafa Arsetya ScorpioPDF');
  pdfDoc.setProducer('Deyafa Arsetya ScorpioPDF');

  let totalPagesGenerated = 0;

  try {
    // Estimasi baris per halaman berdasarkan orientasi dan mode
    let rowsPerPage = 28;
    if (options.orientation === 'portrait') rowsPerPage = 38;
    if (options.fitMode === 'fit-page') rowsPerPage = 999999;

    // Kumpulkan seluruh halaman yang akan dirender
    const pageRenderTasks: {
      sheetName: string;
      headerRow: (string | number | boolean | null)[];
      rowsChunk: (string | number | boolean | null)[][];
      pageIdx: number;
      totalPagesInSheet: number;
      isSinglePageFit: boolean;
    }[] = [];

    for (const sheet of sheetsToProcess) {
      if (sheet.rows.length === 0) continue;

      const headerRow = sheet.rows[0] || [];
      const bodyRows = sheet.rows.slice(1);

      if (options.fitMode === 'fit-page' || bodyRows.length <= rowsPerPage) {
        pageRenderTasks.push({
          sheetName: sheet.name,
          headerRow,
          rowsChunk: bodyRows,
          pageIdx: 1,
          totalPagesInSheet: 1,
          isSinglePageFit: options.fitMode === 'fit-page',
        });
      } else {
        const totalChunks = Math.ceil(bodyRows.length / rowsPerPage);
        for (let c = 0; c < totalChunks; c++) {
          const chunk = bodyRows.slice(c * rowsPerPage, (c + 1) * rowsPerPage);
          pageRenderTasks.push({
            sheetName: sheet.name,
            headerRow,
            rowsChunk: chunk,
            pageIdx: c + 1,
            totalPagesInSheet: totalChunks,
            isSinglePageFit: false,
          });
        }
      }
    }

    if (pageRenderTasks.length === 0) {
      throw new Error('Data spreadsheet kosong atau tidak memiliki baris data.');
    }

    // Render setiap halaman ke kanvas
    for (let taskIdx = 0; taskIdx < pageRenderTasks.length; taskIdx++) {
      const task = pageRenderTasks[taskIdx];
      onProgress?.(taskIdx + 1, pageRenderTasks.length);

      // Buat elemen halaman DOM
      const pageEl = document.createElement('div');
      pageEl.style.width = `${pagePxWidth}px`;
      pageEl.style.height = `${pagePxHeight}px`;
      pageEl.style.padding = '36px 40px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.backgroundColor = '#FFFFFF';
      pageEl.style.display = 'flex';
      pageEl.style.flexDirection = 'column';
      pageEl.style.overflow = 'hidden';
      pageEl.style.fontFamily =
        'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

      // Header Halaman (Judul Sheet & Informasi Halaman)
      const topBar = document.createElement('div');
      topBar.style.display = 'flex';
      topBar.style.justifyContent = 'space-between';
      topBar.style.alignItems = 'center';
      topBar.style.marginBottom = '14px';
      topBar.style.borderBottom = `2px solid ${themeConfig.accent}`;
      topBar.style.paddingBottom = '8px';

      const titleEl = document.createElement('div');
      titleEl.style.fontSize = '16px';
      titleEl.style.fontWeight = 'bold';
      titleEl.style.color = '#0F172A';
      titleEl.innerText = `${managed.name} — ${task.sheetName}`;
      topBar.appendChild(titleEl);

      const pageNumEl = document.createElement('div');
      pageNumEl.style.fontSize = '12px';
      pageNumEl.style.fontWeight = '600';
      pageNumEl.style.color = '#64748B';
      pageNumEl.innerText = `Hal ${task.pageIdx} / ${task.totalPagesInSheet}`;
      topBar.appendChild(pageNumEl);

      pageEl.appendChild(topBar);

      // Wrapper Tabel
      const tableWrapper = document.createElement('div');
      tableWrapper.style.flex = '1';
      tableWrapper.style.overflow = 'hidden';

      const tableEl = document.createElement('table');
      tableEl.style.width = '100%';
      tableEl.style.borderCollapse = 'collapse';
      tableEl.style.fontSize = task.isSinglePageFit
        ? '10px'
        : options.orientation === 'landscape'
        ? '11px'
        : '10px';

      // Baris Header Tabel
      if (task.headerRow && task.headerRow.length > 0) {
        const thead = document.createElement('thead');
        const headerTr = document.createElement('tr');
        headerTr.style.backgroundColor = themeConfig.headerBg;

        task.headerRow.forEach((col) => {
          const th = document.createElement('th');
          th.style.color = themeConfig.headerText;
          th.style.padding = '8px 10px';
          th.style.fontWeight = '700';
          th.style.textAlign = 'left';
          th.style.fontSize = '11px';
          th.style.border = options.showGridlines ? '1px solid rgba(255,255,255,0.2)' : 'none';
          th.innerText = String(col ?? '').trim();
          headerTr.appendChild(th);
        });
        thead.appendChild(headerTr);
        tableEl.appendChild(thead);
      }

      // Baris Isi Tabel
      const tbody = document.createElement('tbody');
      task.rowsChunk.forEach((row, rowIdx) => {
        const tr = document.createElement('tr');
        if (options.stripedRows && rowIdx % 2 === 1) {
          tr.style.backgroundColor = '#F8FAFC';
        }

        task.headerRow.forEach((_, colIdx) => {
          const td = document.createElement('td');
          const cellVal = row[colIdx];
          const { text, isNumber } = formatCellValue(cellVal);

          td.style.padding = '6px 10px';
          td.style.color = '#334155';
          td.style.textAlign = isNumber ? 'right' : 'left';
          td.style.border = options.showGridlines ? '1px solid #E2E8F0' : 'none';
          td.innerText = text;
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
      tableEl.appendChild(tbody);
      tableWrapper.appendChild(tableEl);
      pageEl.appendChild(tableWrapper);

      // Footer Catatan Kaki
      const footerEl = document.createElement('div');
      footerEl.style.marginTop = 'auto';
      footerEl.style.paddingTop = '10px';
      footerEl.style.display = 'flex';
      footerEl.style.justifyContent = 'space-between';
      footerEl.style.fontSize = '10px';
      footerEl.style.color = '#94A3B8';
      footerEl.style.borderTop = '1px solid #F1F5F9';

      const brandEl = document.createElement('span');
      brandEl.innerText = 'Deyafa Arsetya ScorpioPDF — Konversi Excel ke PDF';
      footerEl.appendChild(brandEl);

      pageEl.appendChild(footerEl);
      mountContainer.appendChild(pageEl);

      // Render menggunakan html2canvas pada skala 2x
      const canvas = await html2canvas(pageEl, {
        scale: 2.0,
        backgroundColor: '#FFFFFF',
        logging: false,
        useCORS: true,
      });

      // Bersihkan pageEl dari container
      mountContainer.removeChild(pageEl);

      // Ekspor ke JPEG
      const jpegBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.94)
      );

      if (!jpegBlob) {
        throw new Error(`Gagal merender halaman ${taskIdx + 1} ke format gambar.`);
      }

      const jpegBuffer = await jpegBlob.arrayBuffer();
      const embeddedImage = await pdfDoc.embedJpg(new Uint8Array(jpegBuffer));

      // Tambahkan lembar halaman ke PDFDocument
      const page = pdfDoc.addPage([widthPt, heightPt]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: widthPt,
        height: heightPt,
      });

      totalPagesGenerated++;
      // Jeda tick mikro untuk menjaga responsivitas UI
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    if (mountContainer.parentNode) {
      mountContainer.parentNode.removeChild(mountContainer);
    }
  }

  const pdfBytes = await pdfDoc.save();
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const pdfBlob = new Blob([copy.buffer], { type: 'application/pdf' });

  const finalFileName = sanitizePdfFilename(
    options.outputName || stripExcelExtension(managed.name)
  );

  return {
    blob: pdfBlob,
    fileName: finalFileName,
    pageCount: totalPagesGenerated,
    sheetCount: sheetsToProcess.length,
    sizeBytes: pdfBlob.size,
  };
}

