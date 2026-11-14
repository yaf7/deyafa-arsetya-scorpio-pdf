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
  executeExtractPages,
  ExtractMode,
  formatBytes,
  formatPageNumbers,
  GeneratedExtractPagesResult,
  inspectPdfForExtractPages,
  InspectExtractPagesResult,
  parsePageRangeInput,
  sanitizePdfFilename,
  sanitizeZipFilename,
  stripPdfExtension,
} from '@/app/lib/extract-pages';
import { Navbar } from './Navbar';

export function ExtractPagesWorkspace() {
  // Berkas PDF Sumber
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspectData, setInspectData] = useState<InspectExtractPagesResult | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Set nomor halaman yang DIPILIH UNTUK DIEKSTRAK (1-indexed)
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  // Input teks rentang halaman (misal: "1, 3-5, 8")
  const [rangeInput, setRangeInput] = useState<string>('');

  // Mode Ekstraksi: 'merged' (gabung 1 PDF) atau 'separate' (arsip ZIP tiap halaman terpisah)
  const [extractMode, setExtractMode] = useState<ExtractMode>('merged');

  // Opsi Berkas Output
  const [outputName, setOutputName] = useState<string>('');

  // Status Eksekusi
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<{ current: number; total: number; message: string } | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);

  // Hasil Eksekusi
  const [result, setResult] = useState<GeneratedExtractPagesResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Drag & Drop
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Modal zoom pratinjau halaman
  const [activeZoomPage, setActiveZoomPage] = useState<number | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeResultUrlRef = useRef<string | null>(null);
  const activeThumbnailsRef = useRef<string[]>([]);

  // Bersihkan Object URLs saat unmount
  useEffect(() => {
    return () => {
      if (activeResultUrlRef.current) {
        URL.revokeObjectURL(activeResultUrlRef.current);
        activeResultUrlRef.current = null;
      }
      activeThumbnailsRef.current.forEach((url) => URL.revokeObjectURL(url));
      activeThumbnailsRef.current = [];
    };
  }, []);

  const clearResult = useCallback(() => {
    if (activeResultUrlRef.current) {
      URL.revokeObjectURL(activeResultUrlRef.current);
      activeResultUrlRef.current = null;
    }
    setResultUrl(null);
    setResult(null);
  }, []);

  // Pemilihan File PDF
  const handleSelectFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setLoadError('Pilih file berkas berformat PDF yang valid (.pdf).');
        return;
      }

      setLoadError(null);
      setProcessError(null);
      clearResult();

      // Bersihkan thumbnail sebelumnya
      activeThumbnailsRef.current.forEach((url) => URL.revokeObjectURL(url));
      activeThumbnailsRef.current = [];

      setIsLoadingPdf(true);
      setSelectedFile(file);
      setSelectedPages(new Set());
      setRangeInput('');
      setOutputName(`${stripPdfExtension(file.name)}-ekstrak`);

      try {
        const inspected = await inspectPdfForExtractPages(file, (loaded, total) => {
          setLoadProgress({ loaded, total });
        });

        inspected.pages.forEach((p) => {
          if (p.thumbnailUrl) activeThumbnailsRef.current.push(p.thumbnailUrl);
        });

        setInspectData(inspected);
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Gagal memuat dan menganalisis berkas PDF. Pastikan file tidak rusak atau terkunci sandi.'
        );
        setSelectedFile(null);
        setInspectData(null);
      } finally {
        setIsLoadingPdf(false);
        setLoadProgress(null);
      }
    },
    [clearResult]
  );

  // Reset Dokumen Total
  const handleResetDocument = () => {
    clearResult();
    activeThumbnailsRef.current.forEach((url) => URL.revokeObjectURL(url));
    activeThumbnailsRef.current = [];
    setSelectedFile(null);
    setInspectData(null);
    setLoadError(null);
    setProcessError(null);
    setSelectedPages(new Set());
    setRangeInput('');
    setOutputName('');
    setActiveZoomPage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Dukungan Ctrl + V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (inspectData) return;
      if (!e.clipboardData?.files?.length) return;
      const pdf = Array.from(e.clipboardData.files).find(
        (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
      );
      if (pdf) {
        e.preventDefault();
        void handleSelectFile(pdf);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleSelectFile, inspectData]);

  // Drag & Drop
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
      void handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  // Toggle satu halaman untuk diekstrak
  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      setRangeInput(formatPageNumbers(Array.from(next)));
      return next;
    });
    clearResult();
  };

  // Update dari input teks rentang nomor halaman
  const handleRangeInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRangeInput(val);
    if (!inspectData) return;
    const parsed = parsePageRangeInput(val, inspectData.pageCount);
    setSelectedPages(parsed);
    clearResult();
  };

  // Tombol Pintas: Pilih Semua Halaman
  const handleSelectAll = () => {
    if (!inspectData) return;
    const all = new Set<number>();
    for (let i = 1; i <= inspectData.pageCount; i++) {
      all.add(i);
    }
    setSelectedPages(all);
    setRangeInput(formatPageNumbers(Array.from(all)));
    clearResult();
  };

  // Tombol Pintas: Pilih Halaman Ganjil
  const handleSelectOdd = () => {
    if (!inspectData) return;
    const odds = new Set<number>();
    for (let i = 1; i <= inspectData.pageCount; i += 2) {
      odds.add(i);
    }
    setSelectedPages(odds);
    setRangeInput(formatPageNumbers(Array.from(odds)));
    clearResult();
  };

  // Tombol Pintas: Pilih Halaman Genap
  const handleSelectEven = () => {
    if (!inspectData) return;
    const evens = new Set<number>();
    for (let i = 2; i <= inspectData.pageCount; i += 2) {
      evens.add(i);
    }
    setSelectedPages(evens);
    setRangeInput(formatPageNumbers(Array.from(evens)));
    clearResult();
  };

  // Tombol Pintas: Balikkan Pilihan
  const handleInvertSelection = () => {
    if (!inspectData) return;
    const inverted = new Set<number>();
    for (let i = 1; i <= inspectData.pageCount; i++) {
      if (!selectedPages.has(i)) {
        inverted.add(i);
      }
    }
    setSelectedPages(inverted);
    setRangeInput(formatPageNumbers(Array.from(inverted)));
    clearResult();
  };

  // Tombol Pintas: Kosongkan Pilihan
  const handleClearSelection = () => {
    setSelectedPages(new Set());
    setRangeInput('');
    clearResult();
  };

  // Eksekusi Ekstraksi Halaman
  const handleStartExtraction = async () => {
    if (!selectedFile || !inspectData) return;

    if (selectedPages.size === 0) {
      setProcessError('Pilih setidaknya 1 halaman yang ingin diekstrak.');
      return;
    }

    setProcessError(null);
    clearResult();
    setIsProcessing(true);
    setProcessStatus({ current: 1, total: 4, message: 'Menyiapkan dokumen...' });

    try {
      const res = await executeExtractPages(
        selectedFile,
        {
          mode: extractMode,
          selectedPages,
          outputName: outputName || `${stripPdfExtension(selectedFile.name)}-ekstrak`,
        },
        (current, total, message) => {
          setProcessStatus({ current, total, message });
        }
      );

      const url = URL.createObjectURL(res.blob);
      activeResultUrlRef.current = url;
      setResultUrl(url);
      setResult(res);
    } catch (err) {
      setProcessError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mengekstrak halaman dokumen PDF.'
      );
    } finally {
      setIsProcessing(false);
      setProcessStatus(null);
    }
  };

  // Statistik Ringkasan
  const selectedCount = selectedPages.size;
  const totalPages = inspectData?.pageCount || 0;

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F8F9FC] text-slate-900">
      <div
        className="bg-dot-grid pointer-events-none fixed inset-0 z-0 opacity-75"
        aria-hidden="true"
      />

      <Navbar />

      {/* Input File Tersembunyi */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.files && e.target.files.length > 0) {
            void handleSelectFile(e.target.files[0]);
          }
        }}
        className="hidden"
        aria-label="Pilih berkas PDF"
      />

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigasi */}
        <div className="mb-6 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-slate-800 transition flex items-center gap-1">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
              </svg>
              <span>Semua Alat</span>
            </Link>
            <span>/</span>
            <span className="text-slate-400">ATUR PDF</span>
            <span>/</span>
            <span className="font-bold text-slate-900">Ekstrak Halaman</span>
          </div>

          {/* Indikator Berkas Saat Dokumen Sudah Dimuat */}
          {inspectData && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-2xs border border-slate-200">
                <span className="text-emerald-600 font-extrabold">📄</span>
                <span className="max-w-[200px] truncate">{inspectData.fileName}</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  ({inspectData.pageCount} Hal • {formatBytes(inspectData.fileSize)})
                </span>
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Ganti File
              </button>
              <button
                type="button"
                onClick={handleResetDocument}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-2xs transition hover:bg-rose-100 cursor-pointer"
              >
                Hapus
              </button>
            </div>
          )}
        </div>

        {/* Hero Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/80 px-3.5 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider shadow-2xs">
            <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            EKSTRAK HALAMAN • Fleksibel &amp; Presisi
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">
            Ekstrak Halaman Tertentu dari <span className="text-emerald-600">Dokumen PDF</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Ambil lembar-lembar penting dari PDF besar Anda. Gabungkan menjadi satu dokumen PDF baru yang ringkas, atau unduh tiap halaman sebagai berkas terpisah dalam arsip ZIP. Kualitas teks asli dan vektor tetap terjaga sempurna.
          </p>
        </div>

        {/* Notifikasi Pesan Kesalahan */}
        {(loadError || processError) && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 sm:text-sm shadow-xs">
            <svg className="h-5 w-5 shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 font-medium">{loadError || processError}</div>
            <button
              onClick={() => {
                setLoadError(null);
                setProcessError(null);
              }}
              className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 1: BELUM ADA FILE (DROPZONE BERSIH TANPA PREVIEW AWAL) */}
        {/* ========================================================================================= */}
        {!inspectData && (
          <div className="mx-auto w-full max-w-3xl">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-300 ${
                isDraggingFile
                  ? 'border-emerald-500 bg-emerald-50/70 shadow-2xl scale-[1.01]'
                  : 'border-slate-300/80 bg-white/95 shadow-xl shadow-slate-200/50 hover:border-emerald-400 hover:bg-white hover:shadow-2xl hover:scale-[1.005]'
              }`}
            >
              {/* Visual Icon */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 transition-transform duration-300 group-hover:scale-110">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md border-2 border-white">
                  <span className="text-[10px] font-black font-mono">EXT</span>
                </div>
              </div>

              {isLoadingPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
                  <p className="text-base font-semibold text-slate-700">
                    Memuat dan menganalisis berkas PDF...
                  </p>
                  {loadProgress && (
                    <p className="text-xs text-slate-400 font-mono">
                      Merender pratinjau halaman {loadProgress.loaded} dari {loadProgress.total}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="font-display text-lg sm:text-xl font-black text-slate-900">
                    Pilih atau Tarik Berkas PDF ke Sini
                  </p>
                  <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Unggah berkas dokumen PDF yang ingin Anda ekstrak halamannya. Anda juga dapat menempel berkas langsung dengan <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 border border-slate-300">Ctrl + V</kbd>.
                  </p>

                  {/* Tombol Utama Unggah */}
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 px-6 shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all cursor-pointer text-sm"
                    >
                      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Pilih Berkas PDF dari Komputer</span>
                    </button>
                  </div>

                  {/* Keunggulan Fitur */}
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>100% Client-Side Tanpa Upload Server</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                      <span>Gabung Jadi 1 PDF atau Berkas Terpisah (ZIP)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span>Seleksi Visual &amp; Input Rentang Halaman</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 2: FILE SUDAH DIMUAT (RUANG KERJA EKSTRAK HALAMAN INTERAKTIF) */}
        {/* ========================================================================================= */}
        {inspectData && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Kolom Kiri: Grid Visual Seluruh Halaman Dokumen (lg:col-span-8) */}
            <div className="space-y-4 lg:col-span-8">
              {/* Toolbar Pengendali Pemilihan & Rentang Nomor */}
              <div className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Pilih Halaman yang Ingin Diekstrak
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Klik langsung pada kartu halaman, atau ketik rentang nomor di bawah.
                    </p>
                  </div>

                  {/* Tombol Pintas Seleksi Cepat */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 hover:border-slate-300 hover:bg-white transition cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectOdd}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 hover:border-slate-300 hover:bg-white transition cursor-pointer"
                    >
                      Ganjil
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectEven}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 hover:border-slate-300 hover:bg-white transition cursor-pointer"
                    >
                      Genap
                    </button>
                    <button
                      type="button"
                      onClick={handleInvertSelection}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 hover:border-slate-300 hover:bg-white transition cursor-pointer"
                    >
                      Balikkan
                    </button>
                    {selectedPages.size > 0 && (
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="rounded-xl border border-slate-200 bg-rose-50 px-2.5 py-1 font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                      >
                        Kosongkan (0)
                      </button>
                    )}
                  </div>
                </div>

                {/* Input Teks Rentang Nomor Halaman */}
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={rangeInput}
                    onChange={handleRangeInputChange}
                    placeholder="Contoh: 1, 3-5, 8, 12 (halaman yang akan diekstrak)"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 py-2.5 pl-10 pr-24 text-xs font-semibold text-slate-800 placeholder-slate-400 shadow-inner transition focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-2.5 text-[11px] font-bold text-emerald-700">
                    {selectedPages.size} Halaman Terpilih
                  </span>
                </div>
              </div>

              {/* Grid Visual Seluruh Halaman */}
              <div className="rounded-3xl border border-slate-200/90 bg-slate-100/70 p-4 sm:p-6 shadow-inner max-h-[640px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {inspectData.pages.map((p) => {
                    const isSelected = selectedPages.has(p.pageNum);

                    return (
                      <div
                        key={p.pageNum}
                        onClick={() => togglePageSelection(p.pageNum)}
                        className={`group relative flex flex-col items-center rounded-2xl border p-2.5 shadow-sm transition-all duration-200 cursor-pointer select-none ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/25 shadow-md'
                            : 'border-slate-200/90 bg-white hover:border-slate-400 hover:shadow-md'
                        }`}
                      >
                        {/* Thumbnail Halaman */}
                        <div className="relative w-full overflow-hidden rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                          {p.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.thumbnailUrl}
                              alt={`Halaman ${p.pageNum}`}
                              className="w-full object-contain transition-all duration-200"
                            />
                          ) : (
                            <div className="flex h-36 w-full items-center justify-center text-xs text-slate-300">
                              Halaman {p.pageNum}
                            </div>
                          )}

                          {/* Checkbox Indikator di Pojok Atas */}
                          <div className="absolute top-2 right-2 flex items-center justify-center">
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-full border transition shadow-xs ${
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-slate-300 bg-white/90 text-transparent group-hover:border-emerald-400'
                              }`}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>

                          {/* Tombol Perbesar Zoom Pojok Kiri Bawah */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveZoomPage(p.pageNum);
                            }}
                            className="absolute bottom-1.5 left-1.5 rounded-lg bg-slate-900/70 p-1 text-white opacity-0 group-hover:opacity-100 hover:bg-slate-900 transition shadow"
                            title="Perbesar Pratinjau Halaman"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </button>
                        </div>

                        {/* Bar Informasi Nomor Halaman Bawah */}
                        <div className="mt-2.5 flex w-full items-center justify-between text-xs px-1">
                          <span className={`font-bold ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                            Hal {p.pageNum}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              isSelected
                                ? 'bg-emerald-200 text-emerald-900'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isSelected ? '✓ Terpilih' : 'Dilewati'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Panel Opsi Ekstraksi & Tombol Aksi (lg:col-span-4) */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-6 sticky top-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Opsi Ekstraksi
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Tentukan bagaimana halaman terpilih disimpan
                  </p>
                </div>

                {/* 1. Pemilihan Mode Hasil Ekstraksi */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Mode Penyimpanan Hasil
                  </label>

                  {/* Mode A: Gabung Jadi 1 PDF */}
                  <div
                    onClick={() => setExtractMode('merged')}
                    className={`cursor-pointer rounded-2xl border p-3.5 transition select-none ${
                      extractMode === 'merged'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-extrabold flex items-center gap-1.5">
                        <span>📑</span> Gabung Jadi 1 PDF Baru
                      </span>
                      {extractMode === 'merged' && (
                        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-normal leading-relaxed">
                      Seluruh halaman terpilih disatukan menjadi satu dokumen PDF baru yang ringkas.
                    </p>
                  </div>

                  {/* Mode B: Ekstrak Tiap Halaman Terpisah (ZIP) */}
                  <div
                    onClick={() => setExtractMode('separate')}
                    className={`cursor-pointer rounded-2xl border p-3.5 transition select-none ${
                      extractMode === 'separate'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-extrabold flex items-center gap-1.5">
                        <span>📦</span> Ekstrak Tiap Halaman Terpisah (ZIP)
                      </span>
                      {extractMode === 'separate' && (
                        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-normal leading-relaxed">
                      Tiap halaman menjadi file PDF mandiri (1 lembar per file) dan diunduh dalam arsip .ZIP.
                    </p>
                  </div>
                </div>

                {/* Kotak Ringkasan Halaman Real-Time */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Total Halaman Asli:</span>
                    <span className="font-extrabold text-slate-900 font-mono">
                      {totalPages} Halaman
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <span>✓</span> Halaman Terpilih:
                    </span>
                    <span className="font-extrabold text-emerald-700 font-mono text-sm">
                      {selectedCount} Hal
                    </span>
                  </div>

                  {selectedCount > 0 && (
                    <div className="text-[11px] text-slate-600 bg-white rounded-xl p-2.5 border border-slate-200 font-mono leading-relaxed">
                      <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold mb-0.5">
                        Daftar Nomor Diekstrak:
                      </span>
                      {formatPageNumbers(Array.from(selectedPages))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Format Hasil:</span>
                    <span className="font-bold text-slate-800">
                      {extractMode === 'merged'
                        ? '1 Dokumen PDF'
                        : `${selectedCount} Berkas PDF (.ZIP)`}
                    </span>
                  </div>
                </div>

                {/* Pesan Validasi Status */}
                {selectedCount === 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-800 font-medium">
                    💡 <strong>Belum ada halaman yang dipilih.</strong> Klik halaman yang ingin Anda ekstrak.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800 font-medium">
                    ✅ Siap diekstrak! Sebanyak <strong>{selectedCount} halaman</strong> akan diproses.
                  </div>
                )}

                {/* Pengaturan Nama File Output */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nama File Hasil
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="dokumen-ekstrak"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-12 text-xs font-semibold text-slate-800 transition focus:border-emerald-500 focus:bg-white focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-xs font-bold text-emerald-700">
                      {extractMode === 'merged' || selectedCount <= 1 ? '.pdf' : '.zip'}
                    </span>
                  </div>
                </div>

                {/* Progres Ekstraksi */}
                {isProcessing && processStatus && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                      <span>{processStatus.message}</span>
                      <span>{Math.round((processStatus.current / processStatus.total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-300"
                        style={{
                          width: `${(processStatus.current / processStatus.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Tombol CTA Utama (Rose Merah Menonjol) */}
                <button
                  type="button"
                  onClick={handleStartExtraction}
                  disabled={isProcessing || selectedCount === 0}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all duration-200 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Mengekstrak Halaman...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                      <span>
                        {selectedCount > 0
                          ? `Ekstrak ${selectedCount} Halaman Sekarang`
                          : 'Pilih Halaman untuk Diekstrak'}
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

        {/* ========================================================================================= */}
        {/* HASIL EKSEKUSI SELESAI */}
        {/* ========================================================================================= */}
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
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase">
                      Ekstraksi Selesai
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

              <div className="flex flex-wrap items-center gap-3">
                {!result.isZip && (
                  <a
                    href={resultUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span>Buka di Tab Baru</span>
                  </a>
                )}
                <a
                  href={resultUrl}
                  download={result.fileName}
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-7 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_rgba(225,29,72,0.45)] transition-all cursor-pointer"
                >
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>
                    {result.isZip
                      ? 'Unduh Arsip ZIP Sekarang'
                      : 'Unduh Berkas PDF Hasil Ekstrak'}
                  </span>
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

            {/* Statistik Hasil Ekstraksi */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Halaman Asli</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {result.originalPageCount} Hal
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Halaman Diekstrak</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">
                  {result.extractedPageCount} Hal
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Format Dokumen</div>
                <div className="text-base sm:text-lg font-black text-slate-900 mt-1 uppercase">
                  {result.isZip ? 'ZIP Bundle' : 'PDF Tunggal'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Ukuran Akhir</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {formatBytes(result.sizeBytes)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Perbesar Zoom Halaman */}
        {activeZoomPage !== null && inspectData && (
          <div
            onClick={() => setActiveZoomPage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-3xl bg-white p-4 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Pratinjau Halaman {activeZoomPage} dari {inspectData.pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveZoomPage(null)}
                  className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              {inspectData.pages[activeZoomPage - 1]?.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inspectData.pages[activeZoomPage - 1].thumbnailUrl}
                  alt={`Halaman ${activeZoomPage}`}
                  className="max-h-[75vh] w-auto rounded-xl object-contain mx-auto shadow-md"
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
