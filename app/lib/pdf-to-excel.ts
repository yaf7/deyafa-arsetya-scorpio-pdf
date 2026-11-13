import * as XLSX from 'xlsx';

export type ExcelWorkbookStructure = 'single-sheet' | 'multi-sheet';

export const EXCEL_WORKBOOK_STRUCTURES: Record<
  ExcelWorkbookStructure,
  { label: string; tag: string; desc: string }
> = {
  'single-sheet': {
    label: 'Gabung ke 1 Sheet Utama',
    tag: 'Rekomendasi',
    desc: 'Seluruh tabel dari halaman terpilih digabung berurutan ke dalam satu lembar kerja rapi',
  },
  'multi-sheet': {
    label: '1 Sheet per Halaman PDF',
    tag: 'Terpisah',
    desc: 'Setiap halaman PDF dibuatkan tab lembar kerja terpisah (Halaman 1, Halaman 2, dst.)',
  },
};

export type ExcelDetectionMode = 'table-smart' | 'table-only' | 'raw-grid';

export const EXCEL_DETECTION_MODES: Record<
  ExcelDetectionMode,
  { label: string; tag: string; desc: string }
> = {
  'table-smart': {
    label: 'Deteksi Tabel Pintar',
    tag: 'Otomatis',
    desc: 'Mengelompokkan teks berdasarkan koordinat visual baris & kolom secara presisi',
  },
  'table-only': {
    label: 'Hanya Tabel (Abaikan Narasi)',
    tag: 'Filter Grid',
    desc: 'Hanya mengekstrak baris yang memiliki minimal 2 kolom data, menyaring teks pengantar',
  },
  'raw-grid': {
    label: 'Grid Presisi Spasial',
    tag: 'Posisi Asli',
    desc: 'Memetakan sel sesuai koordinat posisi X dan Y asli pada halaman dokumen',
  },
};

export type ExcelDataFormat = 'auto-detect' | 'text-plain';

export const EXCEL_DATA_FORMATS: Record<
  ExcelDataFormat,
  { label: string; tag: string; desc: string }
> = {
  'auto-detect': {
    label: 'Otomatis Deteksi Angka & Rumus',
    tag: 'Siap Hitung',
    desc: 'Mengonversi angka, mata uang, dan persentase menjadi format numerik agar siap dihitung (SUM, dsb.)',
  },
  'text-plain': {
    label: 'Simpan Sebagai Teks Murni',
    tag: 'Anti-Ubah',
    desc: 'Menyimpan teks persis seperti aslinya tanpa otomatisasi tipe data angka',
  },
};

export type ExcelTheme = 'emerald' | 'blue' | 'slate' | 'none';

export const EXCEL_THEMES: Record<
  ExcelTheme,
  { label: string; headerBg: string; headerText: string; accent: string; border: string }
> = {
  emerald: {
    label: 'Hijau Excel Klasik',
    headerBg: '#059669',
    headerText: '#FFFFFF',
    accent: '#10B981',
    border: '#D1FAE5',
  },
  blue: {
    label: 'Biru Korporat',
    headerBg: '#2563EB',
    headerText: '#FFFFFF',
    accent: '#3B82F6',
    border: '#DBEAFE',
  },
  slate: {
    label: 'Abu-Abu Profesional',
    headerBg: '#334155',
    headerText: '#FFFFFF',
    accent: '#64748B',
    border: '#E2E8F0',
  },
  none: {
    label: 'Polos Standar',
    headerBg: '#F1F5F9',
    headerText: '#0F172A',
    accent: '#94A3B8',
    border: '#CBD5E1',
  },
};

export type ExcelExportFormat = 'xlsx' | 'csv';

export const EXCEL_EXPORT_FORMATS: Record<
  ExcelExportFormat,
  { label: string; ext: string; desc: string }
> = {
  xlsx: {
    label: 'Microsoft Excel (.xlsx)',
    ext: '.xlsx',
    desc: 'Format workbook modern lengkap dengan pewarnaan, sheet terpisah, dan rumus angka',
  },
  csv: {
    label: 'Nilai Koma CSV (.csv)',
    ext: '.csv',
    desc: 'Format teks data tabular universal untuk analisis database atau aplikasi eksternal',
  },
};

export interface ExtractedCell {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isNumber: boolean;
  numValue?: number;
}

export interface ExtractedRow {
  y: number;
  cells: (string | number)[];
  rawCells: ExtractedCell[];
  isHeader?: boolean;
}

export interface PdfPageTableSummary {
  pageNumber: number; // 1-indexed
  widthPt: number;
  heightPt: number;
  aspectRatio: number;
  thumbnailUrl: string;
  charCount: number;
  rowCount: number;
  colCount: number;
  previewRows: (string | number)[][];
  allRows: (string | number)[][];
}

export interface ManagedPdfForExcel {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  pages: PdfPageTableSummary[];
  grandTotalRows: number;
  grandMaxCols: number;
}

export interface ConvertPdfToExcelOptions {
  structure: ExcelWorkbookStructure;
  detectionMode: ExcelDetectionMode;
  dataFormat: ExcelDataFormat;
  theme: ExcelTheme;
  exportFormat: ExcelExportFormat;
  selectedPages: number[]; // 1-indexed
  outputName?: string;
}

export interface GeneratedExcelResult {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  totalRows: number;
  totalCols: number;
  sheetCount: number;
  format: ExcelExportFormat;
  theme: ExcelTheme;
}

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF ke EXCEL hanya dapat dijalankan di browser.');
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

export function sanitizeExcelFilename(name: string, ext = '.xlsx', fallback = 'laporan-excel'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`;
}

/**
 * Deteksi apakah teks sel berupa angka / nilai keuangan (Rupiah, Dollar, Persen, Desimal)
 */
export function parseNumericValue(text: string): { isNumber: boolean; val?: number } {
  const trimmed = text.trim();
  if (!trimmed) return { isNumber: false };

  // Bersihkan simbol mata uang & tanda umum: Rp, $, EUR, %, spasi
  const clean = trimmed
    .replace(/^Rp\.?\s*/i, '')
    .replace(/^[$€£¥]\s*/, '')
    .replace(/%\s*$/, '')
    .trim();

  // Pola angka Indonesia: 1.500.000 atau 1.500.000,50
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean)) {
    const standardized = clean.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(standardized);
    if (!isNaN(n)) return { isNumber: true, val: n };
  }

  // Pola angka internasional: 1,500,000 or 1,500,000.50
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) {
    const standardized = clean.replace(/,/g, '');
    const n = parseFloat(standardized);
    if (!isNaN(n)) return { isNumber: true, val: n };
  }

  // Pola angka desimal murni sederhana: 12345 atau 12345.67 atau 12345,67
  if (/^-?\d+([.,]\d+)?$/.test(clean)) {
    const standardized = clean.replace(',', '.');
    const n = parseFloat(standardized);
    if (!isNaN(n)) return { isNumber: true, val: n };
  }

  // Angka negatif bertanda kurung: (1.500.000)
  if (/^\([0-9.,]+\)$/.test(clean)) {
    const inner = clean.slice(1, -1);
    const sub = parseNumericValue(inner);
    if (sub.isNumber && sub.val !== undefined) {
      return { isNumber: true, val: -Math.abs(sub.val) };
    }
  }

  return { isNumber: false };
}

/**
 * Analisis spasial teks PDF untuk membentuk baris dan kolom tabel yang terstruktur
 */
function extractTableRowsFromTextItems(
  items: Array<{ str: string; transform: number[]; width: number; height: number }>,
  viewportHeight: number
): (string | number)[][] {
  if (!items || items.length === 0) return [];

  interface RawItem {
    text: string;
    x: number;
    y: number; // Diselaraskan dari atas ke bawah
    width: number;
    height: number;
  }

  const parsedItems: RawItem[] = [];

  for (const it of items) {
    const str = it.str ? it.str.trim() : '';
    if (!str) continue;

    // transform: [scaleX, skewY, skewX, scaleY, tx, ty]
    const x = it.transform[4] || 0;
    const ty = it.transform[5] || 0;
    // PDF origin ada di kiri bawah, ubah ke kiri atas
    const y = viewportHeight - ty;
    const width = it.width || 0;
    const height = Math.abs(it.transform[3] || 10);

    parsedItems.push({ text: it.str, x, y, width, height });
  }

  if (parsedItems.length === 0) return [];

  // Urutkan vertikal dari atas ke bawah, lalu horizontal kiri ke kanan
  parsedItems.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 4.5) {
      return yDiff;
    }
    return a.x - b.x;
  });

  // 1. Kelompokkan ke dalam Baris (Row Clustering)
  const rows: Array<{ y: number; items: RawItem[] }> = [];
  const ROW_Y_TOLERANCE = 5.0; // Toleransi keselarasan vertikal sel

  for (const item of parsedItems) {
    const matchingRow = rows.find((r) => Math.abs(r.y - item.y) <= ROW_Y_TOLERANCE);
    if (matchingRow) {
      matchingRow.items.push(item);
      // Rata-rata bobot posisi Y
      matchingRow.y = (matchingRow.y * (matchingRow.items.length - 1) + item.y) / matchingRow.items.length;
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  // 2. Gabungkan fragmen teks yang bersebelahan sangat dekat (misal spasi dalam 1 kata)
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    const merged: RawItem[] = [];

    for (const it of row.items) {
      if (merged.length === 0) {
        merged.push({ ...it });
      } else {
        const last = merged[merged.length - 1];
        const gap = it.x - (last.x + last.width);
        // Jika jarak antar fragmen kurang dari 5pt, gabungkan
        if (gap < 5.0 && gap > -2.0) {
          last.text += (last.text.endsWith(' ') || it.text.startsWith(' ') ? '' : ' ') + it.text;
          last.width = it.x + it.width - last.x;
        } else {
          merged.push({ ...it });
        }
      }
    }
    row.items = merged;
  }

  // 3. Deteksi Batas Kolom Global (Column Boundary Clustering)
  const allXPositions: number[] = [];
  for (const row of rows) {
    for (const it of row.items) {
      allXPositions.push(it.x);
    }
  }

  allXPositions.sort((a, b) => a - b);

  // Buat cluster kolom jika ada beberapa baris yang memiliki teks di X yang berdekatan
  const colClusters: number[] = [];
  const COL_X_TOLERANCE = 14.0;

  for (const x of allXPositions) {
    const existing = colClusters.find((c) => Math.abs(c - x) <= COL_X_TOLERANCE);
    if (!existing) {
      colClusters.push(x);
    }
  }

  colClusters.sort((a, b) => a - b);

  // 4. Petakan Setiap Baris ke Grid Kolom Terstruktur
  const gridRows: (string | number)[][] = [];

  for (const row of rows) {
    const rowCells: string[] = new Array(Math.max(1, colClusters.length)).fill('');

    for (const it of row.items) {
      // Temukan cluster kolom terdekat
      let closestColIdx = 0;
      let minDiff = Infinity;
      colClusters.forEach((colX, idx) => {
        const diff = Math.abs(colX - it.x);
        if (diff < minDiff) {
          minDiff = diff;
          closestColIdx = idx;
        }
      });

      const cleanText = it.text.trim();
      if (!cleanText) continue;

      if (rowCells[closestColIdx]) {
        rowCells[closestColIdx] += ' ' + cleanText;
      } else {
        rowCells[closestColIdx] = cleanText;
      }
    }

    // Hilangkan sel kosong di sebelah kanan
    while (rowCells.length > 0 && rowCells[rowCells.length - 1] === '') {
      rowCells.pop();
    }

    if (rowCells.some((c) => c !== '')) {
      gridRows.push(rowCells);
    }
  }

  return gridRows;
}

/**
 * Muat file PDF, buat thumbnail halaman dan deteksi tabel untuk preview
 */
export async function inspectPdfForExcel(
  file: File,
  onThumbnailReady?: (pageNum: number, summary: PdfPageTableSummary) => void
): Promise<ManagedPdfForExcel> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages: PdfPageTableSummary[] = [];

  let grandTotalRows = 0;
  let grandMaxCols = 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    // Ekstrak teks dan hitung posisi koordinat
    const textContent = await page.getTextContent();
    const items = (textContent.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>).filter((it) => typeof it.str === 'string');

    let charCount = 0;
    items.forEach((it) => (charCount += it.str.length));

    // Ekstraksi baris tabel dari teks spasial
    const tableRows = extractTableRowsFromTextItems(items, viewport.height);
    const rowCount = tableRows.length;
    const colCount = tableRows.reduce((max, r) => Math.max(max, r.length), 0);

    grandTotalRows += rowCount;
    if (colCount > grandMaxCols) grandMaxCols = colCount;

    // Render thumbnail kanvas halaman
    const thumbScale = Math.min(1.2, 420 / viewport.width);
    const thumbViewport = page.getViewport({ scale: thumbScale });
    const canvas = document.createElement('canvas');
    canvas.width = thumbViewport.width;
    canvas.height = thumbViewport.height;
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

    const pageSummary: PdfPageTableSummary = {
      pageNumber: pageNum,
      widthPt: Math.round(viewport.width),
      heightPt: Math.round(viewport.height),
      aspectRatio: viewport.width / viewport.height,
      thumbnailUrl,
      charCount,
      rowCount,
      colCount,
      previewRows: tableRows.slice(0, 15),
      allRows: tableRows,
    };

    pages.push(pageSummary);
    onThumbnailReady?.(pageNum, pageSummary);
  }

  return {
    id: `pdf-excel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    name: file.name,
    size: file.size,
    pageCount,
    pages,
    grandTotalRows,
    grandMaxCols,
  };
}

/**
 * Konversi Dokumen PDF menjadi Workbook Excel (.xlsx / .csv)
 */
export async function convertPdfToExcel(
  managed: ManagedPdfForExcel,
  options: ConvertPdfToExcelOptions,
  onProgress?: (current: number, total: number) => void
): Promise<GeneratedExcelResult> {
  const selectedPageSummaries = managed.pages.filter((p) =>
    options.selectedPages.includes(p.pageNumber)
  );

  if (selectedPageSummaries.length === 0) {
    throw new Error('Pilih minimal satu halaman dokumen untuk dikonversi ke Excel.');
  }

  const wb = XLSX.utils.book_new();
  const themeConfig = EXCEL_THEMES[options.theme];

  let totalExportedRows = 0;
  let totalExportedCols = 0;

  // Filter baris sesuai detectionMode
  const filterRowsByMode = (rows: (string | number)[][]): (string | number)[][] => {
    if (options.detectionMode === 'table-only') {
      // Hanya sertakan baris yang memiliki minimal 2 kolom data terisi
      return rows.filter((r) => r.filter((c) => c !== '' && c !== null && c !== undefined).length >= 2);
    }
    return rows;
  };

  // Format nilai sel (auto-detect angka vs text-plain)
  const formatCellValues = (rows: (string | number)[][]): (string | number)[][] => {
    return rows.map((row) =>
      row.map((cell) => {
        if (typeof cell === 'number') return cell;
        const str = String(cell ?? '').trim();
        if (!str) return '';

        if (options.dataFormat === 'auto-detect') {
          const numCheck = parseNumericValue(str);
          if (numCheck.isNumber && numCheck.val !== undefined) {
            return numCheck.val;
          }
        }
        return str;
      })
    );
  };

  if (options.structure === 'multi-sheet') {
    // 1 Sheet per Halaman PDF
    for (let idx = 0; idx < selectedPageSummaries.length; idx++) {
      const pageSummary = selectedPageSummaries[idx];
      onProgress?.(idx + 1, selectedPageSummaries.length);

      const filtered = filterRowsByMode(pageSummary.allRows);
      const formatted = formatCellValues(filtered);

      const ws = XLSX.utils.aoa_to_sheet(formatted);

      // Hitung lebar kolom otomatis
      const colWidths: { wch: number }[] = [];
      formatted.forEach((row) => {
        row.forEach((val, cIdx) => {
          const len = String(val ?? '').length;
          colWidths[cIdx] = {
            wch: Math.max(colWidths[cIdx]?.wch || 10, Math.min(45, len + 3)),
          };
        });
      });
      ws['!cols'] = colWidths;

      const sheetName = `Halaman ${pageSummary.pageNumber}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      totalExportedRows += formatted.length;
      formatted.forEach((r) => {
        if (r.length > totalExportedCols) totalExportedCols = r.length;
      });
    }
  } else {
    // Gabung Seluruh Halaman ke 1 Sheet Utama
    const combinedRows: (string | number)[][] = [];

    for (let idx = 0; idx < selectedPageSummaries.length; idx++) {
      const pageSummary = selectedPageSummaries[idx];
      onProgress?.(idx + 1, selectedPageSummaries.length);

      const filtered = filterRowsByMode(pageSummary.allRows);
      const formatted = formatCellValues(filtered);

      if (formatted.length > 0) {
        if (selectedPageSummaries.length > 1) {
          // Tambahkan header pemisah halaman jika multi-page
          combinedRows.push([`[ --- HALAMAN ${pageSummary.pageNumber} --- ]`]);
        }
        combinedRows.push(...formatted);
        // Tambahkan baris kosong antar halaman
        if (idx < selectedPageSummaries.length - 1) {
          combinedRows.push([]);
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(combinedRows);

    // Hitung lebar kolom otomatis
    const colWidths: { wch: number }[] = [];
    combinedRows.forEach((row) => {
      row.forEach((val, cIdx) => {
        const len = String(val ?? '').length;
        colWidths[cIdx] = {
          wch: Math.max(colWidths[cIdx]?.wch || 10, Math.min(45, len + 3)),
        };
      });
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Data Ekstraksi PDF');

    totalExportedRows = combinedRows.length;
    combinedRows.forEach((r) => {
      if (r.length > totalExportedCols) totalExportedCols = r.length;
    });
  }

  // Generate File Output
  let blob: Blob;
  const baseName = options.outputName?.trim() || stripPdfExtension(managed.name);

  if (options.exportFormat === 'csv') {
    // CSV Output
    const firstSheetName = wb.SheetNames[0] || 'Sheet1';
    const csvContent = XLSX.utils.sheet_to_csv(wb.Sheets[firstSheetName]);
    blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  } else {
    // XLSX Output
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  const finalFileName = sanitizeExcelFilename(
    baseName,
    options.exportFormat === 'csv' ? '.csv' : '.xlsx',
    'laporan-ekstraksi-pdf'
  );

  return {
    blob,
    fileName: finalFileName,
    sizeBytes: blob.size,
    totalRows: totalExportedRows,
    totalCols: totalExportedCols,
    sheetCount: wb.SheetNames.length,
    format: options.exportFormat,
    theme: options.theme,
  };
}
