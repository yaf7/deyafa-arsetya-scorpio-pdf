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
  convertPdfToExcel,
  ConvertPdfToExcelOptions,
  EXCEL_DATA_FORMATS,
  EXCEL_DETECTION_MODES,
  EXCEL_EXPORT_FORMATS,
  EXCEL_THEMES,
  EXCEL_WORKBOOK_STRUCTURES,
  ExcelDataFormat,
  ExcelDetectionMode,
  ExcelExportFormat,
  ExcelTheme,
  ExcelWorkbookStructure,
  formatBytes,
  GeneratedExcelResult,
  inspectPdfForExcel,
  ManagedPdfForExcel,
  parseNumericValue,
  PdfPageTableSummary,
  stripPdfExtension,
} from '@/app/lib/pdf-to-excel';
import { Navbar } from './Navbar';

export function PdfToExcelWorkspace() {
  const [pdfFile, setPdfFile] = useState<ManagedPdfForExcel | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Opsi Konversi
  const [structure, setStructure] = useState<ExcelWorkbookStructure>('single-sheet');
  const [detectionMode, setDetectionMode] = useState<ExcelDetectionMode>('table-smart');
  const [dataFormat, setDataFormat] = useState<ExcelDataFormat>('auto-detect');
  const [theme, setTheme] = useState<ExcelTheme>('emerald');
  const [exportFormat, setExportFormat] = useState<ExcelExportFormat>('xlsx');
  const [outputName, setOutputName] = useState<string>('');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [showGridlines, setShowGridlines] = useState<boolean>(true);
  const [stripedRows, setStripedRows] = useState<boolean>(true);

  // Lembar / Halaman Pratinjau Aktif
  const [activePreviewPageNum, setActivePreviewPageNum] = useState<number>(1);

  // Status Drag & Drop
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Status Konversi
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Hasil Konversi
  const [result, setResult] = useState<GeneratedExcelResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Lightbox Modal
  const [lightboxPage, setLightboxPage] = useState<PdfPageTableSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeThumbUrlsRef = useRef<Set<string>>(new Set());
  const activeResultUrlRef = useRef<string | null>(null);

  // Bersihkan seluruh object URL saat komponen unmount
  useEffect(() => {
    const thumbs = activeThumbUrlsRef.current;
    return () => {
      thumbs.forEach((url) => URL.revokeObjectURL(url));
      thumbs.clear();
      if (activeResultUrlRef.current) {
        URL.revokeObjectURL(activeResultUrlRef.current);
        activeResultUrlRef.current = null;
      }
    };
  }, []);

  // Tutup Lightbox dengan tombol Escape
  useEffect(() => {
    if (!lightboxPage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxPage(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxPage]);

  const clearResult = useCallback(() => {
    if (activeResultUrlRef.current) {
      URL.revokeObjectURL(activeResultUrlRef.current);
      activeResultUrlRef.current = null;
    }
    setResultUrl(null);
    setResult(null);
  }, []);

  const handleProcessPdfFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setLoadError('File harus berupa dokumen PDF yang valid (.pdf).');
        return;
      }

      setLoadError(null);
      setConversionError(null);
      clearResult();
      setIsLoadingPdf(true);

      // Bersihkan thumbnail lama
      activeThumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      activeThumbUrlsRef.current.clear();

      try {
        const inspected = await inspectPdfForExcel(
          file,
          (_pageNum, summary) => {
            if (summary.thumbnailUrl) {
              activeThumbUrlsRef.current.add(summary.thumbnailUrl);
            }
            setPdfFile((prev) => {
              if (!prev || prev.file !== file) return prev;
              return {
                ...prev,
                pages: prev.pages.map((p) =>
                  p.pageNumber === _pageNum ? { ...p, thumbnailUrl: summary.thumbnailUrl } : p
                ),
              };
            });
          }
        );

        setPdfFile(inspected);
        setSelectedPages(Array.from({ length: inspected.pageCount }, (_, i) => i + 1));
        setActivePreviewPageNum(1);
        setOutputName(stripPdfExtension(file.name));
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? `Gagal membaca file PDF: ${err.message}`
            : 'Dokumen PDF rusak atau terkunci password sehingga tidak dapat diproses.'
        );
        setPdfFile(null);
      } finally {
        setIsLoadingPdf(false);
      }
    },
    [clearResult]
  );

  // Dukungan Ctrl + V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      const file = Array.from(e.clipboardData.files).find((f) =>
        f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
      );
      if (file) {
        e.preventDefault();
        handleProcessPdfFile(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleProcessPdfFile]);

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
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessPdfFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessPdfFile(e.target.files[0]);
    }
  };

  // Pengelolaan Seleksi Halaman
  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) => {
      if (prev.includes(pageNum)) {
        return prev.filter((p) => p !== pageNum);
      } else {
        return [...prev, pageNum].sort((a, b) => a - b);
      }
    });
  };

  const handleSelectAllPages = () => {
    if (!pdfFile) return;
    setSelectedPages(Array.from({ length: pdfFile.pageCount }, (_, i) => i + 1));
  };

  const handleDeselectAllPages = () => {
    setSelectedPages([]);
  };

  const handleSelectOddPages = () => {
    if (!pdfFile) return;
    const odds: number[] = [];
    for (let i = 1; i <= pdfFile.pageCount; i += 2) odds.push(i);
    setSelectedPages(odds);
  };

  const handleSelectEvenPages = () => {
    if (!pdfFile) return;
    const evens: number[] = [];
    for (let i = 2; i <= pdfFile.pageCount; i += 2) evens.push(i);
    setSelectedPages(evens);
  };

  const handleResetDocument = () => {
    clearResult();
    setPdfFile(null);
    setSelectedPages([]);
    setLoadError(null);
    setConversionError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Eksekusi Konversi
  const handleStartConversion = async () => {
    if (!pdfFile) return;
    if (selectedPages.length === 0) {
      setConversionError('Pilih minimal satu halaman dokumen untuk diekstrak ke Excel.');
      return;
    }

    setConversionError(null);
    clearResult();
    setIsConverting(true);
    setProgress({ current: 0, total: selectedPages.length });

    try {
      const options: ConvertPdfToExcelOptions = {
        structure,
        detectionMode,
        dataFormat,
        theme,
        exportFormat,
        selectedPages,
        outputName,
      };

      const res = await convertPdfToExcel(
        pdfFile,
        options,
        (current, total) => {
          setProgress({ current, total });
        }
      );

      const url = URL.createObjectURL(res.blob);
      activeResultUrlRef.current = url;
      setResultUrl(url);
      setResult(res);
    } catch (err) {
      setConversionError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mengekstrak tabel PDF ke Excel. Pastikan dokumen tidak rusak.'
      );
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  };

  // Data Pratinjau Tabel Halaman Aktif
  const activePageSummary = pdfFile?.pages.find(
    (p) => p.pageNumber === activePreviewPageNum
  ) || pdfFile?.pages[0];

  // Filter baris pratinjau sesuai mode deteksi
  const getDisplayRows = (rows: (string | number)[][]) => {
    if (detectionMode === 'table-only') {
      return rows.filter((r) => r.filter((c) => c !== '' && c !== null && c !== undefined).length >= 2);
    }
    return rows;
  };

  const displayRows = activePageSummary ? getDisplayRows(activePageSummary.previewRows) : [];

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F8F9FC] text-slate-900">
      <div
        className="bg-dot-grid pointer-events-none fixed inset-0 z-0 opacity-75"
        aria-hidden="true"
      />

      <Navbar />

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb & Identitas Alat */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-slate-800 transition flex items-center gap-1">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
            <span>Semua Alat</span>
          </Link>
          <span>/</span>
          <span className="text-slate-400">KONVERSI DARI PDF</span>
          <span>/</span>
          <span className="font-bold text-slate-900">PDF ke EXCEL</span>
        </div>

        {/* Hero Section Singkat */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/80 px-3.5 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider shadow-2xs">
            <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF ke EXCEL • Konversi Cerdas
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">
            Konversi <span className="text-emerald-600">PDF ke EXCEL</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Ekstrak data tabel, laporan keuangan, faktur, dan lembar angka dari dokumen PDF menjadi spreadsheet Microsoft Excel (<code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-emerald-700 font-semibold">.xlsx</code> / <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-emerald-700 font-semibold">.csv</code>) yang rapi, dengan deteksi angka siap hitung rumus.
          </p>
        </div>

        {/* Notifikasi Error Membaca File */}
        {loadError && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 sm:text-sm shadow-xs">
            <svg className="h-5 w-5 shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 font-medium">{loadError}</div>
            <button onClick={() => setLoadError(null)} className="text-rose-500 hover:text-rose-700 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* KONDISI 1: Belum Ada File PDF Dipilih */}
        {!pdfFile && (
          <div className="mx-auto w-full max-w-3xl">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-300 ${
                isDraggingFile
                  ? 'border-emerald-500 bg-emerald-50/60 shadow-2xl scale-[1.01]'
                  : 'border-slate-300/80 bg-white/90 shadow-xl shadow-slate-200/50 hover:border-emerald-400 hover:bg-white hover:shadow-2xl hover:scale-[1.005]'
              }`}
            >
              {/* Icon Visual */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 transition-transform duration-300 group-hover:scale-110">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-md border-2 border-white">
                  <span className="text-[10px] font-extrabold uppercase">XLS</span>
                </div>
              </div>

              {isLoadingPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
                  <p className="text-base font-semibold text-slate-700">
                    Memindai tabel dan struktur teks dokumen PDF...
                  </p>
                  <p className="text-xs text-slate-400">
                    Menganalisis koordinat kolom, baris data, dan angka
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 group-hover:text-emerald-600 transition">
                    Pilih File PDF untuk Dikonversi ke Excel
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 max-w-md">
                    Seret & letakkan file <code className="text-emerald-700 font-semibold font-mono">.pdf</code> ke sini, klik untuk memilih, atau tekan <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">Ctrl + V</kbd> untuk menempel.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Deteksi Tabel Otomatis
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Format Angka Siap Rumus (SUM dsb)
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Dukungan Multi-Sheet Terpisah
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
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Pilih File PDF Sekarang
                  </button>
                </>
              )}
            </div>

            {/* Fitur Utama */}
            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold mb-3">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Kolom & Baris Rapi
                </h4>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Algoritma pemetaan spasial mengelompokkan teks PDF ke dalam sel kolom dan baris Excel tanpa tumpang tindih.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 font-bold mb-3">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Format Angka Asli
                </h4>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Nilai mata uang (Rp), persentase, dan nominal angka otomatis dikonversi ke tipe data angka sejati sehingga langsung bisa dijumlahkan.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 font-bold mb-3">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  100% Aman & Lokal
                </h4>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Laporan keuangan dan data sensitif perusahaan Anda tidak pernah diunggah ke server luar, pemrosesan 100% terjadi di peramban Anda.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KONDISI 2: File PDF Telah Dimuat */}
        {pdfFile && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Kolom Kiri: Pratinjau Halaman & Spreadsheet Live (lg:col-span-8) */}
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
                    <h3 className="truncate text-base font-bold text-slate-900" title={pdfFile.name}>
                      {pdfFile.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatBytes(pdfFile.size)}</span>
                      <span>•</span>
                      <span>{pdfFile.pageCount} Halaman PDF</span>
                      <span>•</span>
                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ~{pdfFile.grandTotalRows.toLocaleString('id-ID')} Baris Data Terdeteksi
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

              {/* Pemilih Halaman PDF */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Pilih Halaman untuk Dikonversi:
                    </span>
                    <button
                      onClick={handleSelectAllPages}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Pilih Semua
                    </button>
                    <button
                      onClick={handleDeselectAllPages}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleSelectOddPages}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Ganjil
                    </button>
                    <button
                      onClick={handleSelectEvenPages}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Genap
                    </button>
                  </div>

                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    {selectedPages.length} dari {pdfFile.pageCount} halaman dipilih
                  </span>
                </div>

                {/* Grid Thumbnail Halaman PDF */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 max-h-72 overflow-y-auto p-1">
                  {pdfFile.pages.map((p) => {
                    const isSelected = selectedPages.includes(p.pageNumber);
                    const isActive = activePreviewPageNum === p.pageNumber;

                    return (
                      <div
                        key={p.pageNumber}
                        onClick={() => {
                          setActivePreviewPageNum(p.pageNumber);
                        }}
                        className={`group relative flex flex-col rounded-xl border-2 p-2 transition cursor-pointer select-none ${
                          isActive
                            ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                            : isSelected
                            ? 'border-emerald-300 bg-white'
                            : 'border-slate-200 bg-slate-50/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold">
                          <label
                            className="flex items-center gap-1.5 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePageSelection(p.pageNumber)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="text-slate-700">Hal {p.pageNumber}</span>
                          </label>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxPage(p);
                            }}
                            className="text-slate-400 hover:text-emerald-700"
                            title="Perbesar pratinjau halaman"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                          </button>
                        </div>

                        {/* Thumbnail Container */}
                        <div className="relative aspect-[1/1.35] w-full overflow-hidden rounded-lg bg-slate-100 flex items-center justify-center">
                          {p.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.thumbnailUrl}
                              alt={`Halaman ${p.pageNumber}`}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
                          )}
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[9px] text-slate-500">
                          <span>~{p.rowCount} baris</span>
                          <span>{p.colCount} kol</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PRATINJAU HASIL EXCEL LIVE (WYSIWYG Sesuai Tema, Struktur Sheet & Format Angka) */}
              {activePageSummary && (
                <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm sm:text-base text-slate-900">
                        Pratinjau Tabel Excel Hasil Ekstraksi
                      </span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Live WYSIWYG
                      </span>
                    </div>

                    {/* Tag Pengaturan Aktif */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-slate-700">
                        {EXCEL_WORKBOOK_STRUCTURES[structure].label.split('(')[0].trim()}
                      </span>
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-blue-700">
                        {EXCEL_DETECTION_MODES[detectionMode].label.split('(')[0].trim()}
                      </span>
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-amber-800">
                        {EXCEL_DATA_FORMATS[dataFormat].label.split('(')[0].trim()}
                      </span>
                      <span
                        style={{
                          backgroundColor: `${EXCEL_THEMES[theme].headerBg}18`,
                          color: theme === 'none' ? '#334155' : EXCEL_THEMES[theme].headerBg,
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
                      <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-emerald-900 uppercase font-mono">
                        {exportFormat}
                      </span>
                    </div>
                  </div>

                  {/* Simulasi Lembar Kerja Excel */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    {/* Header Bar Lembar Kerja */}
                    <div
                      style={{
                        borderBottom: '3px solid',
                        borderColor: EXCEL_THEMES[theme].headerBg,
                      }}
                      className="flex flex-wrap items-center justify-between pb-2 text-xs transition-colors duration-200"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            backgroundColor: `${EXCEL_THEMES[theme].headerBg}18`,
                            color: theme === 'none' ? '#334155' : EXCEL_THEMES[theme].headerBg,
                          }}
                          className="rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors duration-200"
                        >
                          {structure === 'multi-sheet'
                            ? `Sheet: Halaman ${activePageSummary.pageNumber}`
                            : 'Sheet: Data Ekstraksi PDF'}
                        </span>
                        <span className="font-bold text-slate-800 truncate">
                          {pdfFile.name}
                        </span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {displayRows.length} baris ditampilkan
                      </span>
                    </div>

                    {/* Tabel Spreadsheet */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs max-h-96">
                      {displayRows.length > 0 ? (
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr
                              style={{
                                backgroundColor: EXCEL_THEMES[theme].headerBg,
                                color: EXCEL_THEMES[theme].headerText,
                              }}
                            >
                              <th
                                style={{
                                  backgroundColor: EXCEL_THEMES[theme].headerBg,
                                  color: EXCEL_THEMES[theme].headerText,
                                  border: showGridlines ? '1px solid rgba(255,255,255,0.3)' : 'none',
                                }}
                                className="w-10 px-2 py-2 text-center font-mono text-[10px] font-bold"
                              >
                                #
                              </th>
                              {displayRows[0].map((_, cIdx) => (
                                <th
                                  key={cIdx}
                                  style={{
                                    backgroundColor: EXCEL_THEMES[theme].headerBg,
                                    color: EXCEL_THEMES[theme].headerText,
                                    border: showGridlines ? '1px solid rgba(255,255,255,0.3)' : 'none',
                                  }}
                                  className="px-3 py-2 text-left font-bold transition-colors duration-200"
                                >
                                  Kolom {String.fromCharCode(65 + (cIdx % 26))}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {displayRows.map((row, rIdx) => {
                              const isZebra = stripedRows && rIdx % 2 === 1;
                              const zebraBg =
                                theme === 'blue'
                                  ? 'bg-blue-50/50'
                                  : theme === 'slate'
                                  ? 'bg-slate-100/70'
                                  : theme === 'emerald'
                                  ? 'bg-emerald-50/40'
                                  : 'bg-slate-50/80';

                              return (
                                <tr key={rIdx} className={isZebra ? zebraBg : 'bg-white'}>
                                  <td
                                    style={{
                                      border: showGridlines ? '1px solid #CBD5E1' : 'none',
                                    }}
                                    className="px-2 py-1.5 text-center font-mono text-[10px] text-slate-400 bg-slate-50/50"
                                  >
                                    {rIdx + 1}
                                  </td>
                                  {displayRows[0].map((_, cIdx) => {
                                    const rawVal = row[cIdx];
                                    const strVal = rawVal !== null && rawVal !== undefined ? String(rawVal) : '';
                                    const numParsed = parseNumericValue(strVal);
                                    const isNumericCell = dataFormat === 'auto-detect' && numParsed.isNumber;

                                    return (
                                      <td
                                        key={cIdx}
                                        style={{
                                          border: showGridlines ? '1px solid #CBD5E1' : 'none',
                                        }}
                                        className={`px-3 py-1.5 text-slate-800 ${
                                          isNumericCell ? 'text-right font-mono font-medium' : 'text-left'
                                        }`}
                                      >
                                        {strVal ? (
                                          isNumericCell && numParsed.val !== undefined ? (
                                            <span className="inline-block text-emerald-800">
                                              {numParsed.val.toLocaleString('id-ID')}
                                            </span>
                                          ) : (
                                            strVal
                                          )
                                        ) : (
                                          <span className="text-slate-300 italic">-</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          Tidak ada baris data terdeteksi pada halaman ini dengan filter yang dipilih.
                        </div>
                      )}
                    </div>

                    {/* Tab Bar Simulasi Lembar Kerja Excel */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                        Lembar Sheet:
                      </span>
                      {structure === 'multi-sheet' ? (
                        pdfFile.pages.map((p) => {
                          const isCurrentActive = activePreviewPageNum === p.pageNumber;
                          return (
                            <button
                              key={p.pageNumber}
                              type="button"
                              onClick={() => setActivePreviewPageNum(p.pageNumber)}
                              style={
                                isCurrentActive
                                  ? {
                                      borderColor: EXCEL_THEMES[theme].headerBg,
                                      backgroundColor: `${EXCEL_THEMES[theme].headerBg}15`,
                                      color: theme === 'none' ? '#0F172A' : EXCEL_THEMES[theme].headerBg,
                                    }
                                  : undefined
                              }
                              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer select-none ${
                                isCurrentActive
                                  ? 'shadow-2xs font-bold'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              Halaman {p.pageNumber}
                            </button>
                          );
                        })
                      ) : (
                        <span
                          style={{
                            borderColor: EXCEL_THEMES[theme].headerBg,
                            backgroundColor: `${EXCEL_THEMES[theme].headerBg}15`,
                            color: theme === 'none' ? '#0F172A' : EXCEL_THEMES[theme].headerBg,
                          }}
                          className="rounded-lg border px-2.5 py-1 text-[11px] font-bold shadow-2xs"
                        >
                          Data Ekstraksi PDF ({selectedPages.length} Halaman Digabung)
                        </span>
                      )}
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
                    Opsi Konversi ke Excel
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesuaikan struktur sheet, deteksi tabel, format rumus, dan tema
                  </p>
                </div>

                {/* 1. Struktur Lembar Kerja (Workbook Structure) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Struktur Lembar Kerja (Sheets)
                  </label>
                  <div className="space-y-2">
                    {(Object.keys(EXCEL_WORKBOOK_STRUCTURES) as ExcelWorkbookStructure[]).map((key) => {
                      const item = EXCEL_WORKBOOK_STRUCTURES[key];
                      const isSelected = structure === key;
                      return (
                        <div
                          key={key}
                          onClick={() => setStructure(key)}
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

                {/* 2. Mode Deteksi Data */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Mode Deteksi Tabel
                  </label>
                  <div className="space-y-2">
                    {(Object.keys(EXCEL_DETECTION_MODES) as ExcelDetectionMode[]).map((key) => {
                      const item = EXCEL_DETECTION_MODES[key];
                      const isSelected = detectionMode === key;
                      return (
                        <div
                          key={key}
                          onClick={() => setDetectionMode(key)}
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

                {/* 3. Format Angka & Tipe Data */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Format Data & Angka
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(EXCEL_DATA_FORMATS) as ExcelDataFormat[]).map((key) => {
                      const item = EXCEL_DATA_FORMATS[key];
                      const isSelected = dataFormat === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setDataFormat(key)}
                          className={`rounded-xl border p-2.5 text-left transition select-none cursor-pointer ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/70 font-bold text-emerald-950 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xs font-bold">{item.tag}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{item.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Gaya Tabel (Gridlines & Zebra Striping) */}
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                    Gaya & Kerapian Spreadsheet
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGridlines}
                      onChange={(e) => setShowGridlines(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Tampilkan Garis Kisi Sel (Gridlines)</span>
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
                </div>

                {/* 5. Tema Warna Header */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Tema Warna Header Excel
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(EXCEL_THEMES) as ExcelTheme[]).map((key) => {
                      const item = EXCEL_THEMES[key];
                      const isSelected = theme === key;
                      const activeStyles =
                        key === 'blue'
                          ? 'border-blue-600 bg-blue-50/80 text-blue-950 font-bold ring-2 ring-blue-500/30 shadow-sm'
                          : key === 'slate'
                          ? 'border-slate-800 bg-slate-100 text-slate-950 font-bold ring-2 ring-slate-600/30 shadow-sm'
                          : key === 'emerald'
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold ring-2 ring-emerald-500/30 shadow-sm'
                          : 'border-slate-600 bg-slate-100 text-slate-950 font-bold ring-2 ring-slate-400/30 shadow-sm';

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setTheme(key)}
                          className={`rounded-2xl border-2 p-2 text-center text-xs font-semibold transition-all duration-200 cursor-pointer select-none ${
                            isSelected
                              ? activeStyles
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className="relative h-3.5 w-full rounded-md mb-1 shadow-xs flex items-center justify-center transition-transform"
                            style={{ backgroundColor: item.headerBg }}
                          >
                            {isSelected && (
                              <svg
                                className={`h-2.5 w-2.5 ${key === 'none' ? 'text-slate-800' : 'text-white'}`}
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
                          <span className="text-[10px] leading-tight block truncate font-bold">
                            {item.label.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 6. Format File Output (.xlsx / .csv) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Format File Output
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(EXCEL_EXPORT_FORMATS) as ExcelExportFormat[]).map((fmtKey) => {
                      const fmt = EXCEL_EXPORT_FORMATS[fmtKey];
                      const isSelected = exportFormat === fmtKey;
                      return (
                        <button
                          key={fmtKey}
                          type="button"
                          onClick={() => setExportFormat(fmtKey)}
                          className={`rounded-xl border p-2 text-center text-xs font-bold transition cursor-pointer select-none ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {fmt.ext.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 7. Nama File Output */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nama File Output
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="laporan-ekstraksi-pdf"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-14 text-xs font-semibold text-slate-800 transition focus:border-emerald-500 focus:bg-white focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-xs font-bold text-emerald-700">
                      .{exportFormat}
                    </span>
                  </div>
                </div>

                {/* Indikator Progres Konversi */}
                {isConverting && progress && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                      <span>Mengekstrak Halaman {progress.current} dari {progress.total}...</span>
                      <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-200"
                        style={{
                          width: `${(progress.current / progress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Pesan Kesalahan Konversi */}
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
                  disabled={isConverting || selectedPages.length === 0}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all duration-200 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isConverting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Mengekstrak ke Spreadsheet...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>
                        Konversi ke {exportFormat.toUpperCase()} ({selectedPages.length} Hal)
                      </span>
                      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HASIL KONVERSI SELESAI */}
        {result && resultUrl && (
          <div className="mt-8 rounded-3xl border border-emerald-200 bg-white p-6 sm:p-8 shadow-xl shadow-emerald-500/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase">
                      Konversi Berhasil
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {formatBytes(result.sizeBytes)}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    {result.fileName}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={resultUrl}
                  download={result.fileName}
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-7 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_rgba(225,29,72,0.45)] transition-all cursor-pointer"
                >
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Unduh File Spreadsheet Sekarang</span>
                </a>
                <button
                  type="button"
                  onClick={clearResult}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                  title="Tutup banner hasil"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Statistik Hasil */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Total Baris Diekstrak</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {result.totalRows.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Maksimal Kolom</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {result.totalCols} Kolom
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Jumlah Sheet</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {result.sheetCount} Lembar
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Format Output</div>
                <div className="text-2xl font-black text-emerald-700 uppercase mt-1">
                  .{result.format}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* LIGHTBOX MODAL */}
      {lightboxPage && (
        <div
          onClick={() => setLightboxPage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] max-w-4xl flex-col items-center overflow-hidden rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex w-full items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Pratinjau Halaman {lightboxPage.pageNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {lightboxPage.widthPt} × {lightboxPage.heightPt} pt • ~{lightboxPage.rowCount} baris tabel
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPage(null)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex max-h-[72vh] items-center justify-center overflow-auto rounded-xl bg-slate-50 p-2">
              {lightboxPage.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightboxPage.thumbnailUrl}
                  alt={`Halaman ${lightboxPage.pageNumber}`}
                  className="max-h-[66vh] w-auto rounded-lg shadow-md object-contain"
                />
              )}
            </div>

            <div className="mt-4 flex w-full items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  togglePageSelection(lightboxPage.pageNumber);
                }}
                className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition ${
                  selectedPages.includes(lightboxPage.pageNumber)
                    ? 'border border-rose-200 bg-rose-50 text-rose-700'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {selectedPages.includes(lightboxPage.pageNumber)
                  ? '✓ Halaman Ini Dipilih'
                  : '+ Pilih Halaman Ini'}
              </button>

              <button
                type="button"
                onClick={() => setLightboxPage(null)}
                className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

