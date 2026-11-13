'use client';

import Link from 'next/link';
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  convertExcelToPdf,
  ExcelFitMode,
  EXCEL_FIT_MODES,
  ExcelOrientation,
  EXCEL_ORIENTATIONS,
  ExcelPageSize,
  EXCEL_PAGE_SIZES,
  ExcelTheme,
  EXCEL_THEMES,
  formatBytes,
  GeneratedExcelPdfResult,
  inspectExcelWorkbook,
  ManagedExcelFile,
  stripExcelExtension,
} from '@/app/lib/excel-to-pdf';
import { Navbar } from './Navbar';

export function ExcelToPdfWorkspace() {
  const [excelFile, setExcelFile] = useState<ManagedExcelFile | null>(null);
  const [isLoadingExcel, setIsLoadingExcel] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Opsi Konversi
  const [pageSize, setPageSize] = useState<ExcelPageSize>('a4');
  const [orientation, setOrientation] = useState<ExcelOrientation>('landscape');
  const [fitMode, setFitMode] = useState<ExcelFitMode>('fit-width');
  const [theme, setTheme] = useState<ExcelTheme>('emerald');
  const [showGridlines, setShowGridlines] = useState<boolean>(true);
  const [stripedRows, setStripedRows] = useState<boolean>(true);
  const [repeatHeader, setRepeatHeader] = useState<boolean>(true);
  const [outputName, setOutputName] = useState<string>('');
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [activePreviewSheet, setActivePreviewSheet] = useState<string>('');

  // Drag & Drop
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Status Konversi
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Hasil PDF
  const [result, setResult] = useState<GeneratedExcelPdfResult | null>(null);
  const [resultPdfUrl, setResultPdfUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeResultUrlRef = useRef<string | null>(null);

  // Bersihkan object URL saat unmount
  useEffect(() => {
    return () => {
      if (activeResultUrlRef.current) {
        URL.revokeObjectURL(activeResultUrlRef.current);
        activeResultUrlRef.current = null;
      }
    };
  }, []);

  const clearResult = useCallback(() => {
    if (activeResultUrlRef.current) {
      URL.revokeObjectURL(activeResultUrlRef.current);
      activeResultUrlRef.current = null;
    }
    setResultPdfUrl(null);
    setResult(null);
  }, []);

  const handleProcessExcelFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      if (
        !lower.endsWith('.xlsx') &&
        !lower.endsWith('.xls') &&
        !lower.endsWith('.csv') &&
        !lower.endsWith('.ods')
      ) {
        setLoadError(
          'File harus berupa dokumen spreadsheet yang valid (.xlsx, .xls, .csv, atau .ods).'
        );
        return;
      }

      setLoadError(null);
      setConversionError(null);
      clearResult();
      setIsLoadingExcel(true);

      try {
        const inspected = await inspectExcelWorkbook(file);
        setExcelFile(inspected);
        setSelectedSheets(inspected.sheets.map((s) => s.name));
        setActivePreviewSheet(inspected.sheets[0]?.name || '');
        setOutputName(stripExcelExtension(file.name));
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Gagal memproses file spreadsheet. Pastikan file tidak rusak atau terkunci password.'
        );
        setExcelFile(null);
      } finally {
        setIsLoadingExcel(false);
      }
    },
    [clearResult]
  );

  // Dukungan Ctrl + V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      const file = Array.from(e.clipboardData.files).find((f) => {
        const lower = f.name.toLowerCase();
        return (
          lower.endsWith('.xlsx') ||
          lower.endsWith('.xls') ||
          lower.endsWith('.csv') ||
          lower.endsWith('.ods')
        );
      });
      if (file) {
        e.preventDefault();
        handleProcessExcelFile(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleProcessExcelFile]);

  // Handler Drag & Drop
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current--;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDraggingFile(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = Array.from(files).find((f) => {
        const lower = f.name.toLowerCase();
        return (
          lower.endsWith('.xlsx') ||
          lower.endsWith('.xls') ||
          lower.endsWith('.csv') ||
          lower.endsWith('.ods')
        );
      });
      if (file) {
        handleProcessExcelFile(file);
      } else {
        setLoadError('Hanya file spreadsheet (.xlsx, .xls, .csv, .ods) yang didukung.');
      }
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessExcelFile(files[0]);
    }
    e.target.value = '';
  };

  const handleResetDocument = () => {
    clearResult();
    setLoadError(null);
    setConversionError(null);
    setExcelFile(null);
    setSelectedSheets([]);
    setActivePreviewSheet('');
    setOutputName('');
  };

  const toggleSheetSelection = (sheetName: string) => {
    clearResult();
    setSelectedSheets((prev) =>
      prev.includes(sheetName)
        ? prev.filter((s) => s !== sheetName)
        : [...prev, sheetName]
    );
  };

  const handleSelectAllSheets = () => {
    if (!excelFile) return;
    clearResult();
    setSelectedSheets(excelFile.sheets.map((s) => s.name));
  };

  const handleDeselectAllSheets = () => {
    clearResult();
    setSelectedSheets([]);
  };

  // Eksekusi Konversi
  const handleStartConversion = async () => {
    if (!excelFile) return;
    if (selectedSheets.length === 0) {
      setConversionError('Pilih minimal satu lembar kerja (sheet) untuk dikonversi.');
      return;
    }

    setConversionError(null);
    clearResult();
    setIsConverting(true);
    setProgress({ current: 0, total: 1 });

    try {
      const generated = await convertExcelToPdf(
        excelFile,
        {
          pageSize,
          orientation,
          fitMode,
          showGridlines,
          stripedRows,
          repeatHeader,
          theme,
          selectedSheets,
          outputName: outputName || excelFile.name,
        },
        (current, total) => {
          setProgress({ current, total });
        }
      );

      const url = URL.createObjectURL(generated.blob);
      activeResultUrlRef.current = url;
      setResultPdfUrl(url);
      setResult(generated);

      // Otomatis download file PDF
      const autoLink = document.createElement('a');
      autoLink.href = url;
      autoLink.download = generated.fileName;
      document.body.appendChild(autoLink);
      autoLink.click();
      document.body.removeChild(autoLink);
    } catch (err) {
      setConversionError(
        err instanceof Error
          ? err.message
          : 'Terjadi kendala saat menyusun dokumen PDF dari spreadsheet.'
      );
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  };

  const paperAspectRatios: Record<
    ExcelPageSize,
    { landscape: string; portrait: string; mm: string; name: string }
  > = {
    a4: {
      landscape: '1.414 / 1',
      portrait: '1 / 1.414',
      mm: '210 × 297 mm',
      name: 'A4',
    },
    f4: {
      landscape: '1.535 / 1',
      portrait: '1 / 1.535',
      mm: '215 × 330 mm',
      name: 'F4 / Folio',
    },
    letter: {
      landscape: '1.294 / 1',
      portrait: '1 / 1.294',
      mm: '216 × 279 mm',
      name: 'US Letter',
    },
  };

  const currentSheetData = excelFile?.sheets.find(
    (s) => s.name === activePreviewSheet
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex min-h-screen flex-col bg-[#F7F9FC] text-slate-800 antialiased selection:bg-rose-500 selection:text-white"
    >
      <Navbar />

      <main className="relative z-10 mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb navigasi */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-white hover:text-rose-600"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Semua Alat
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-emerald-700 font-bold">EXCEL ke PDF</span>
        </div>

        {/* Hero Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800 shadow-sm backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            SPREADSHEET EXCEL KE PDF • 100% RAPI & PRIVAT
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Konversi <span className="text-emerald-600">EXCEL ke PDF</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Ubah dokumen spreadsheet Excel (<code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-emerald-700 font-semibold">.xlsx</code>, <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-emerald-700 font-semibold">.xls</code>, <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-emerald-700 font-semibold">.csv</code>) menjadi laporan PDF siap cetak dengan pengaturan tabel rapi, orientasi lanskap, dan lebar kolom anti-terpotong.
          </p>
        </div>

        {/* Pesan Error Global */}
        {loadError && (
          <div className="mb-6 mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
            <svg
              className="h-5 w-5 shrink-0 text-rose-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1 font-medium">{loadError}</div>
            <button
              onClick={() => setLoadError(null)}
              className="text-rose-500 hover:text-rose-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* KONDISI 1: Belum Ada File Excel Dipilih */}
        {!excelFile && (
          <div className="mx-auto w-full max-w-3xl">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-300 ${
                isDraggingFile
                  ? 'border-emerald-500 bg-emerald-50/60 shadow-2xl scale-[1.01]'
                  : 'border-slate-300/80 bg-white/90 shadow-xl shadow-slate-200/50 hover:border-emerald-400 hover:bg-white hover:shadow-2xl hover:scale-[1.005]'
              }`}
            >
              {/* Icon Visual */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 transition-transform duration-300 group-hover:scale-110">
                <svg
                  className="h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md border-2 border-white">
                  <span className="text-[10px] font-extrabold uppercase">PDF</span>
                </div>
              </div>

              {isLoadingExcel ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
                  <p className="text-base font-semibold text-slate-700">
                    Menganalisis lembar kerja spreadsheet...
                  </p>
                  <p className="text-xs text-slate-400">
                    Membaca struktur sheet, jumlah baris, dan penyesuaian kolom
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 group-hover:text-emerald-600 transition">
                    Pilih File Spreadsheet Excel
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 max-w-md">
                    Seret & letakkan file <code className="text-emerald-700 font-semibold font-mono">.xlsx</code>, <code className="text-emerald-700 font-semibold font-mono">.xls</code>, atau <code className="text-emerald-700 font-semibold font-mono">.csv</code> ke sini, klik untuk memilih, atau tekan <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">Ctrl + V</kbd> untuk menempel.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Format XLSX, XLS & CSV
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Pas Lebar Halaman (Anti-Terpotong)
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Pilihan A4 & F4 / Folio
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      100% Privat di Browser
                    </span>
                  </div>

                  <button
                    type="button"
                    className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-700 hover:shadow-xl group-hover:scale-105 cursor-pointer"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Pilih File Spreadsheet Sekarang
                  </button>
                </>
              )}
            </div>

            {/* Fitur Utama */}
            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold mb-3">
                  X
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Tabel Tidak Terpotong
                </h4>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Fitur <em>Pas Lebar Halaman</em> otomatis menyesuaikan proporsi tabel agar seluruh kolom muat dalam 1 lebar kertas tanpa terbelah ke halaman lain.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 font-bold mb-3">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Dukungan Multi-Sheet
                </h4>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Pilih apakah ingin mengonversi semua sheet sekaligus ke dalam satu file PDF atau hanya sheet tertentu dengan nomor halaman yang rapi.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 font-bold mb-3">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Privat & Aman
                </h4>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Data angka, gaji, laporan keuangan, atau data pelanggan Anda diproses 100% lokal di browser tanpa dikirim ke server luar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KONDISI 2: File Excel Telah Dimuat */}
        {excelFile && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Kolom Kiri: Pratinjau Sheet & Data Tabel (lg:col-span-8) */}
            <div className="space-y-6 lg:col-span-8">
              {/* Dokumen Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-slate-900" title={excelFile.name}>
                      {excelFile.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatBytes(excelFile.size)}</span>
                      <span>•</span>
                      <span>{excelFile.sheets.length} Lembar Kerja (Sheet)</span>
                      <span>•</span>
                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Total {excelFile.totalRows.toLocaleString('id-ID')} Baris Data
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetDocument}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 cursor-pointer"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Ganti File
                  </button>
                </div>
              </div>

              {/* Pemilih Lembar Kerja (Sheets Selector) */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Pilih Lembar Kerja untuk Dikonversi:
                    </span>
                    <button
                      onClick={handleSelectAllSheets}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Pilih Semua
                    </button>
                    <button
                      onClick={handleDeselectAllSheets}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Reset
                    </button>
                  </div>

                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    {selectedSheets.length} dari {excelFile.sheets.length} sheet dipilih
                  </span>
                </div>

                {/* Pill Tab Sheets */}
                <div className="flex flex-wrap gap-2">
                  {excelFile.sheets.map((s) => {
                    const isSelected = selectedSheets.includes(s.name);
                    const isActive = activePreviewSheet === s.name;
                    return (
                      <div
                        key={s.name}
                        onClick={() => setActivePreviewSheet(s.name)}
                        style={
                          isActive
                            ? {
                                borderColor: EXCEL_THEMES[theme].headerBg,
                                backgroundColor: `${EXCEL_THEMES[theme].headerBg}14`,
                                color: '#0F172A',
                              }
                            : undefined
                        }
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer select-none ${
                          isActive
                            ? 'shadow-sm font-bold ring-1'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSheetSelection(s.name)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>{s.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({s.rowCount} baris, {s.colCount} kol)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pratinjau Lembar Kertas PDF Live (WYSIWYG Sesuai Orientasi, Tema, Garis Kisi & Margin) */}
              {currentSheetData && (
                <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm sm:text-base text-slate-900">
                        Pratinjau Hasil PDF: {currentSheetData.name}
                      </span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Live WYSIWYG
                      </span>
                    </div>

                    {/* Tag Pengaturan Aktif */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-slate-700">
                        {paperAspectRatios[pageSize].name} ({paperAspectRatios[pageSize].mm})
                      </span>
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-emerald-800">
                        {orientation === 'landscape' ? 'Mendatar (Landscape)' : 'Tegak (Portrait)'}
                      </span>
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-blue-700">
                        {EXCEL_FIT_MODES[fitMode].label.split('(')[0].trim()}
                      </span>
                      <span
                        style={{
                          backgroundColor: `${EXCEL_THEMES[theme].headerBg}18`,
                          color: EXCEL_THEMES[theme].headerBg,
                          borderColor: `${EXCEL_THEMES[theme].headerBg}40`,
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition-all duration-200"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: EXCEL_THEMES[theme].headerBg }}
                        />
                        {EXCEL_THEMES[theme].label}
                      </span>
                    </div>
                  </div>

                  {/* Simulasi Kertas Dokumen PDF */}
                  <div className="flex justify-center bg-slate-100/90 p-4 sm:p-6 rounded-2xl overflow-auto shadow-inner">
                    <div
                      style={{
                        width: orientation === 'landscape' ? '100%' : '72%',
                        maxWidth: orientation === 'landscape' ? '920px' : '560px',
                        aspectRatio:
                          orientation === 'landscape'
                            ? paperAspectRatios[pageSize].landscape
                            : paperAspectRatios[pageSize].portrait,
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                      className="bg-white rounded-xl shadow-lg ring-1 ring-slate-200/80 p-6 sm:p-8 flex flex-col space-y-3"
                    >
                      {/* Top Bar Dokumen */}
                      <div
                        style={{
                          borderBottom: '3px solid',
                          borderColor: EXCEL_THEMES[theme].headerBg,
                        }}
                        className="flex justify-between items-center pb-2 text-xs transition-colors duration-200"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            style={{
                              backgroundColor: `${EXCEL_THEMES[theme].headerBg}18`,
                              color: EXCEL_THEMES[theme].headerBg,
                            }}
                            className="rounded-md px-2 py-0.5 text-[10px] font-bold shrink-0 transition-colors duration-200"
                          >
                            {currentSheetData.name}
                          </span>
                          <span className="font-bold text-slate-800 truncate">
                            {excelFile.name}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono shrink-0 ml-2">
                          Hal 1 / 1
                        </span>
                      </div>

                      {/* Tabel Spreadsheet */}
                      <div className="overflow-x-auto flex-1">
                        <table
                          className="w-full border-collapse"
                          style={{
                            fontSize:
                              fitMode === 'fit-page'
                                ? '9.5px'
                                : orientation === 'landscape'
                                ? '11px'
                                : '10px',
                          }}
                        >
                          {currentSheetData.rows.length > 0 && (
                            <thead>
                              <tr
                                style={{
                                  backgroundColor: EXCEL_THEMES[theme].headerBg,
                                  color: EXCEL_THEMES[theme].headerText,
                                }}
                              >
                                {currentSheetData.rows[0].map((th, i) => (
                                  <th
                                    key={i}
                                    style={{
                                      backgroundColor: EXCEL_THEMES[theme].headerBg,
                                      color: EXCEL_THEMES[theme].headerText,
                                      border: showGridlines
                                        ? '1px solid rgba(255,255,255,0.3)'
                                        : 'none',
                                    }}
                                    className="px-3 py-2 text-left font-bold transition-colors duration-200"
                                  >
                                    {String(th ?? '').trim() || `Kolom ${i + 1}`}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {currentSheetData.previewRows.slice(1).map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className={
                                  stripedRows && rIdx % 2 === 1
                                    ? theme === 'blue'
                                      ? 'bg-blue-50/50'
                                      : theme === 'slate'
                                      ? 'bg-slate-100/70'
                                      : 'bg-emerald-50/40'
                                    : 'bg-white'
                                }
                              >
                                {currentSheetData.rows[0].map((_, cIdx) => {
                                  const cell = row[cIdx];
                                  const isNum = typeof cell === 'number';
                                  return (
                                    <td
                                      key={cIdx}
                                      style={{
                                        border: showGridlines ? '1px solid #CBD5E1' : 'none',
                                      }}
                                      className={`px-3 py-1.5 text-slate-700 ${
                                        isNum ? 'text-right font-mono' : 'text-left'
                                      }`}
                                    >
                                      {cell !== null && cell !== undefined
                                        ? String(cell)
                                        : ''}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Catatan Jumlah Baris */}
                      {currentSheetData.rowCount > 10 && (
                        <p className="text-[11px] text-slate-400 text-center pt-2">
                          ... dan {currentSheetData.rowCount - 10} baris lainnya pada sheet ini akan dicetak otomatis.
                        </p>
                      )}

                      {/* Footer Lembar PDF */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center text-[10px] text-slate-400 font-mono gap-2">
                        <span className="font-semibold text-slate-500">
                          {paperAspectRatios[pageSize].name} ({paperAspectRatios[pageSize].mm}) •{' '}
                          {orientation === 'landscape' ? 'Lanskap' : 'Potret'} • Tema:{' '}
                          {EXCEL_THEMES[theme].label.split(' ')[0]} •{' '}
                          {EXCEL_FIT_MODES[fitMode].label.split('(')[0].trim()}
                        </span>
                        <span>Rentang: {currentSheetData.range}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Kolom Kanan: Pengaturan Konversi & Tombol Aksi (lg:col-span-4) */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-6 sticky top-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Opsi Tata Letak PDF
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesuaikan orientasi, ukuran kertas, dan kerapian tabel
                  </p>
                </div>

                {/* 1. Orientasi Halaman */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Orientasi Kertas
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(EXCEL_ORIENTATIONS) as ExcelOrientation[]).map((key) => {
                      const item = EXCEL_ORIENTATIONS[key];
                      const isSelected = orientation === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setOrientation(key)}
                          className={`rounded-xl border p-2.5 text-left transition select-none cursor-pointer ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/70 font-bold text-emerald-950 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xs font-bold">{item.label}</div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {EXCEL_ORIENTATIONS[orientation].desc}
                  </p>
                </div>

                {/* 2. Ukuran Kertas */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ukuran Kertas Dokumen
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as ExcelPageSize)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold text-slate-800 transition focus:border-emerald-500 focus:bg-white focus:outline-none"
                  >
                    {(Object.keys(EXCEL_PAGE_SIZES) as ExcelPageSize[]).map((key) => (
                      <option key={key} value={key}>
                        {EXCEL_PAGE_SIZES[key].label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    {EXCEL_PAGE_SIZES[pageSize].desc}
                  </p>
                </div>

                {/* 3. Penyesuaian Skala Kolom (Fit Mode) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Penyesuaian Skala Kolom
                  </label>
                  <div className="space-y-2">
                    {(Object.keys(EXCEL_FIT_MODES) as ExcelFitMode[]).map((key) => {
                      const item = EXCEL_FIT_MODES[key];
                      const isSelected = fitMode === key;
                      return (
                        <div
                          key={key}
                          onClick={() => setFitMode(key)}
                          className={`cursor-pointer rounded-xl border p-2.5 transition select-none ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/60 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-bold text-slate-900">
                              {item.label}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            {item.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Gaya Tabel */}
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                    Gaya & Kerapian Tabel
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGridlines}
                      onChange={(e) => setShowGridlines(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Tampilkan Garis Kisi Tabel (Gridlines)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stripedRows}
                      onChange={(e) => setStripedRows(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Baris Berselang-Seling (Zebra Striping)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={repeatHeader}
                      onChange={(e) => setRepeatHeader(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Ulangi Header Tabel di Tiap Halaman</span>
                  </label>
                </div>

                {/* 5. Tema Warna Header */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Tema Warna Header
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(EXCEL_THEMES) as ExcelTheme[]).map((key) => {
                      const item = EXCEL_THEMES[key];
                      const isSelected = theme === key;
                      const activeColorStyles =
                        key === 'blue'
                          ? 'border-blue-600 bg-blue-50/80 text-blue-950 font-bold ring-2 ring-blue-500/30 shadow-sm'
                          : key === 'slate'
                          ? 'border-slate-800 bg-slate-100 text-slate-950 font-bold ring-2 ring-slate-600/30 shadow-sm'
                          : 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold ring-2 ring-emerald-500/30 shadow-sm';

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setTheme(key)}
                          className={`rounded-2xl border-2 p-2.5 text-center text-xs font-semibold transition-all duration-200 cursor-pointer select-none ${
                            isSelected
                              ? activeColorStyles
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className="relative h-4 w-full rounded-lg mb-1.5 shadow-xs flex items-center justify-center transition-transform"
                            style={{ backgroundColor: item.headerBg }}
                          >
                            {isSelected && (
                              <svg
                                className="h-3 w-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <span className="text-[11px] leading-tight block truncate font-bold">
                            {item.label.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 6. Nama File Output */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nama File PDF
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="dokumen-excel"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-12 text-xs font-semibold text-slate-800 transition focus:border-emerald-500 focus:bg-white focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-xs font-bold text-emerald-700">
                      .pdf
                    </span>
                  </div>
                </div>

                {/* Indikator Progres Konversi */}
                {isConverting && progress && (
                  <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                      <span>
                        Menyusun halaman {progress.current} dari {progress.total}...
                      </span>
                      <span>
                        {Math.round((progress.current / Math.max(1, progress.total)) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                        style={{
                          width: `${Math.round(
                            (progress.current / Math.max(1, progress.total)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Pesan Error Konversi */}
                {conversionError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                    <span className="font-bold">Gagal: </span>
                    {conversionError}
                  </div>
                )}

                {/* Tombol CTA Utama (Crimson Red Menonjol & Jelas) */}
                <button
                  type="button"
                  onClick={handleStartConversion}
                  disabled={isConverting || selectedSheets.length === 0}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all duration-200 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isConverting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Mengonversi ke PDF...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-5 w-5 transition-transform group-hover:scale-110"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span>Konversi ke PDF Sekarang</span>
                      <svg
                        className="h-4 w-4 transition-transform group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {/* KONDISI HASIL KONVERSI SELESAI */}
              {result && resultPdfUrl && (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-3 text-emerald-800">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold shadow-md">
                      ✓
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base">
                        Konversi Berhasil Selesai!
                      </h4>
                      <p className="text-xs text-emerald-700">
                        File PDF siap dibagikan dan telah otomatis diunduh.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3.5 border border-emerald-100 space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span className="truncate pr-2">{result.fileName}</span>
                      <span className="font-mono text-emerald-600 shrink-0">
                        {formatBytes(result.sizeBytes)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>{result.pageCount} Halaman PDF</span>
                      <span>•</span>
                      <span>{result.sheetCount} Lembar Kerja (Sheet)</span>
                    </div>
                  </div>

                  {/* Tombol Unduh Manual Ulang */}
                  <a
                    href={resultPdfUrl}
                    download={result.fileName}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-3 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Unduh Ulang File PDF
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

