'use client';

import Link from 'next/link';
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  executeSplitPdf,
  formatBytes,
  GeneratedSplitResult,
  getColorByKey,
  getRangeColor,
  inspectPdfForSplit,
  InspectSplitPdfResult,
  OutputFileInfo,
  parsePageSelectionStringToNumbers,
  RANGE_COLOR_PALETTES,
  sanitizePdfFilename,
  SplitMode,
  SplitPdfOptions,
  SplitPdfPageInfo,
  SplitRangeItem,
  stripPdfExtension,
} from '@/app/lib/split-pdf';
import { Navbar } from './Navbar';

export function SplitPdfWorkspace() {
  const [inspectData, setInspectData] = useState<InspectSplitPdfResult | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<{ current: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Status Drag & Drop File
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Mode Pemisahan: 'range' | 'extract' | 'fixed'
  const [mode, setMode] = useState<SplitMode>('range');

  // Opsi Mode 1: Rentang Halaman Kustom
  const [ranges, setRanges] = useState<SplitRangeItem[]>([
    {
      id: 'rng-1',
      name: 'Bagian 1',
      fromPage: 1,
      toPage: 1,
      colorKey: RANGE_COLOR_PALETTES[0].key,
    },
  ]);
  const [mergeRangesIntoOne, setMergeRangesIntoOne] = useState<boolean>(false);

  // Opsi Mode 2: Ekstrak Halaman Tertentu
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [extractTextInput, setExtractTextInput] = useState<string>('');
  const [mergeExtractedIntoOne, setMergeExtractedIntoOne] = useState<boolean>(true);

  // Opsi Mode 3: Pisah Setiap N Halaman
  const [fixedPagesPerSplit, setFixedPagesPerSplit] = useState<number>(1);

  // Nama Dasar File Output
  const [outputBaseName, setOutputBaseName] = useState<string>('');

  // Status Pemrosesan & Hasil
  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  const [splitProgress, setSplitProgress] = useState<{ current: number; total: number } | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedSplitResult | null>(null);
  const [primaryDownloadUrl, setPrimaryDownloadUrl] = useState<string | null>(null);
  const [fileDownloadUrls, setFileDownloadUrls] = useState<Record<string, string>>({});

  // Lightbox Pratinjau Halaman
  const [lightboxPage, setLightboxPage] = useState<SplitPdfPageInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeThumbUrlsRef = useRef<Set<string>>(new Set());
  const activeBlobUrlsRef = useRef<Set<string>>(new Set());

  // Bersihkan URLs saat unmount
  useEffect(() => {
    const thumbs = activeThumbUrlsRef.current;
    const blobs = activeBlobUrlsRef.current;
    return () => {
      thumbs.forEach((url) => URL.revokeObjectURL(url));
      thumbs.clear();
      blobs.forEach((url) => URL.revokeObjectURL(url));
      blobs.clear();
    };
  }, []);

  // Tutup lightbox dengan Escape
  useEffect(() => {
    if (!lightboxPage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxPage(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxPage]);

  const clearResultUrls = useCallback(() => {
    activeBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    activeBlobUrlsRef.current.clear();
    setPrimaryDownloadUrl(null);
    setFileDownloadUrls({});
    setResult(null);
  }, []);

  const handleSelectFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setLoadError('Pilih file dokumen PDF yang valid (.pdf).');
        return;
      }

      setLoadError(null);
      setSplitError(null);
      clearResultUrls();
      setIsLoadingPdf(true);
      setLoadProgress({ current: 0, total: 1 });

      try {
        const inspected = await inspectPdfForSplit(file, (loaded, total) => {
          setLoadProgress({ current: loaded, total });
        });

        inspected.pages.forEach((p) => {
          if (p.thumbnailUrl) activeThumbUrlsRef.current.add(p.thumbnailUrl);
        });

        setInspectData(inspected);
        const totalP = inspected.pageCount;

        // Inisialisasi Opsi Default Sesuai Total Halaman
        const midPage = Math.max(1, Math.min(Math.ceil(totalP / 2), totalP));
        setRanges([
          {
            id: 'rng-1',
            name: 'Bagian 1',
            fromPage: 1,
            toPage: totalP > 1 ? midPage : 1,
            colorKey: RANGE_COLOR_PALETTES[0].key,
          },
          ...(totalP > 1
            ? [
                {
                  id: 'rng-2',
                  name: 'Bagian 2',
                  fromPage: midPage + 1,
                  toPage: totalP,
                  colorKey: RANGE_COLOR_PALETTES[1].key,
                },
              ]
            : []),
        ]);

        // Default ekstrak halaman 1
        setSelectedPages([1]);
        setExtractTextInput('1');

        // Default pisah tiap 1 halaman
        setFixedPagesPerSplit(1);

        setOutputBaseName(stripPdfExtension(file.name));
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? `Gagal membaca file PDF: ${err.message}`
            : 'File PDF tidak dapat diproses. Pastikan dokumen tidak rusak atau terkunci password.'
        );
      } finally {
        setIsLoadingPdf(false);
        setLoadProgress(null);
      }
    },
    [clearResultUrls]
  );

  // Drag & Drop File
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
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  // Dukungan Ctrl + V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      const pdf = Array.from(e.clipboardData.files).find(
        (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
      );
      if (pdf) {
        e.preventDefault();
        handleSelectFile(pdf);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleSelectFile]);

  // Manajemen Rentang (Mode 1)
  const handleAddRange = () => {
    if (!inspectData) return;
    const totalP = inspectData.pageCount;
    const lastRange = ranges[ranges.length - 1];
    const newFrom = lastRange ? Math.min(totalP, lastRange.toPage + 1) : 1;
    const newTo = Math.min(totalP, newFrom + 1);
    const color = getRangeColor(ranges.length);

    setRanges((prev) => [
      ...prev,
      {
        id: `rng-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: `Bagian ${prev.length + 1}`,
        fromPage: newFrom,
        toPage: newTo,
        colorKey: color.key,
      },
    ]);
  };

  const handleRemoveRange = (id: string) => {
    if (ranges.length <= 1) return;
    setRanges((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRange = (
    id: string,
    updates: Partial<Omit<SplitRangeItem, 'id'>>
  ) => {
    setRanges((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  // Manajemen Halaman Terpilih (Mode 2)
  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) => {
      const next = prev.includes(pageNum)
        ? prev.filter((p) => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b);
      setExtractTextInput(next.join(', '));
      return next;
    });
  };

  const handleExtractTextInputChange = (val: string) => {
    setExtractTextInput(val);
    if (!inspectData) return;
    const parsed = parsePageSelectionStringToNumbers(val, inspectData.pageCount);
    setSelectedPages(parsed);
  };

  const handleSelectAllPages = () => {
    if (!inspectData) return;
    const all = Array.from({ length: inspectData.pageCount }, (_, i) => i + 1);
    setSelectedPages(all);
    setExtractTextInput(`1-${inspectData.pageCount}`);
  };

  const handleDeselectAllPages = () => {
    setSelectedPages([]);
    setExtractTextInput('');
  };

  const handleSelectOddPages = () => {
    if (!inspectData) return;
    const odds = Array.from({ length: inspectData.pageCount }, (_, i) => i + 1).filter(
      (p) => p % 2 === 1
    );
    setSelectedPages(odds);
    setExtractTextInput(odds.join(', '));
  };

  const handleSelectEvenPages = () => {
    if (!inspectData) return;
    const evens = Array.from({ length: inspectData.pageCount }, (_, i) => i + 1).filter(
      (p) => p % 2 === 0
    );
    setSelectedPages(evens);
    setExtractTextInput(evens.join(', '));
  };

  // Reset Dokumen
  const handleResetDocument = () => {
    clearResultUrls();
    activeThumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    activeThumbUrlsRef.current.clear();
    setInspectData(null);
    setLoadError(null);
    setSplitError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Perhitungan Pemetaan Halaman ke Rentang untuk Tampilan Visual Live (WYSIWYG)
  const pageRangeMapping = useMemo(() => {
    if (!inspectData || mode !== 'range') return {};
    const mapping: Record<number, { range: SplitRangeItem; index: number }> = {};

    ranges.forEach((rng, rIdx) => {
      const minP = Math.max(1, Math.min(rng.fromPage, rng.toPage));
      const maxP = Math.min(inspectData.pageCount, Math.max(rng.fromPage, rng.toPage));
      for (let p = minP; p <= maxP; p++) {
        // Jika belum ada atau ditimpa oleh rentang terbaru
        mapping[p] = { range: rng, index: rIdx };
      }
    });

    return mapping;
  }, [inspectData, mode, ranges]);

  // Perhitungan Chunk Mode 3 (Pisah Tiap N Halaman)
  const fixedChunks = useMemo(() => {
    if (!inspectData || mode !== 'fixed') return [];
    const totalP = inspectData.pageCount;
    const n = Math.max(1, Math.min(totalP, fixedPagesPerSplit));
    const chunks: { chunkIndex: number; startPage: number; endPage: number }[] = [];
    let idx = 1;

    for (let s = 1; s <= totalP; s += n) {
      const e = Math.min(totalP, s + n - 1);
      chunks.push({ chunkIndex: idx, startPage: s, endPage: e });
      idx++;
    }
    return chunks;
  }, [inspectData, mode, fixedPagesPerSplit]);

  // Eksekusi Pemisahan PDF
  const handleStartSplit = async () => {
    if (!inspectData) return;

    if (mode === 'range' && ranges.length === 0) {
      setSplitError('Tambahkan minimal 1 rentang halaman untuk dipisahkan.');
      return;
    }

    if (mode === 'extract' && selectedPages.length === 0) {
      setSplitError('Pilih minimal 1 halaman yang ingin diekstrak.');
      return;
    }

    setSplitError(null);
    clearResultUrls();
    setIsSplitting(true);
    setSplitProgress({ current: 0, total: 1 });

    try {
      const options: SplitPdfOptions = {
        mode,
        ranges,
        mergeRangesIntoOne,
        selectedPages,
        mergeExtractedIntoOne,
        fixedPagesPerSplit,
        outputBaseName,
      };

      const res = await executeSplitPdf(inspectData, options, (current, total) => {
        setSplitProgress({ current, total });
      });

      const pUrl = URL.createObjectURL(res.primaryBlob);
      activeBlobUrlsRef.current.add(pUrl);
      setPrimaryDownloadUrl(pUrl);

      // Buat URL unduhan untuk masing-masing file individual
      const individualUrls: Record<string, string> = {};
      res.outputFiles.forEach((f) => {
        const u = URL.createObjectURL(f.blob);
        activeBlobUrlsRef.current.add(u);
        individualUrls[f.fileName] = u;
      });
      setFileDownloadUrls(individualUrls);

      setResult(res);
    } catch (err) {
      setSplitError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memisahkan file PDF. Pastikan dokumen tidak terkunci.'
      );
    } finally {
      setIsSplitting(false);
      setSplitProgress(null);
    }
  };

  // Jumlah File Output yang Diproyeksikan
  const projectedOutputFileCount = useMemo(() => {
    if (!inspectData) return 0;
    if (mode === 'range') {
      return mergeRangesIntoOne ? 1 : ranges.length;
    }
    if (mode === 'extract') {
      return mergeExtractedIntoOne ? (selectedPages.length > 0 ? 1 : 0) : selectedPages.length;
    }
    if (mode === 'fixed') {
      return fixedChunks.length;
    }
    return 1;
  }, [inspectData, mode, mergeRangesIntoOne, ranges.length, mergeExtractedIntoOne, selectedPages.length, fixedChunks.length]);

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
          <span className="text-slate-400">ATUR PDF</span>
          <span>/</span>
          <span className="font-bold text-slate-900">Pisah PDF</span>
        </div>

        {/* Hero Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-coral-200/90 bg-rose-50/80 px-3.5 py-1 text-xs font-bold text-rose-800 uppercase tracking-wider shadow-2xs">
            <svg className="h-3.5 w-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
            ATUR PDF • Pisah & Ekstrak Halaman
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">
            Pisahkan <span className="text-rose-600">Halaman PDF</span> Jadi Berkas Terpisah
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Bagi dokumen PDF menjadi beberapa file terpisah berdasarkan rentang halaman kustom, pilih halaman tertentu untuk diekstrak, atau potong otomatis setiap N halaman. 100% aman dan instan di browser Anda.
          </p>
        </div>

        {/* Notifikasi Error */}
        {loadError && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 sm:text-sm shadow-xs">
            <svg className="h-5 w-5 shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 font-medium">{loadError}</div>
            <button onClick={() => setLoadError(null)} className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* KONDISI 1: Belum Ada File Dipilih */}
        {!inspectData && (
          <div className="mx-auto w-full max-w-3xl">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleSelectFile(e.target.files[0]);
                }
              }}
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
                  ? 'border-rose-500 bg-rose-50/60 shadow-2xl scale-[1.01]'
                  : 'border-slate-300/80 bg-white/90 shadow-xl shadow-slate-200/50 hover:border-rose-400 hover:bg-white hover:shadow-2xl hover:scale-[1.005]'
              }`}
            >
              {/* Icon Visual */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-rose-600 to-orange-500 text-white shadow-lg shadow-rose-500/30 transition-transform duration-300 group-hover:scale-110">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md border-2 border-white">
                  <span className="text-[11px] font-extrabold">✂️</span>
                </div>
              </div>

              {isLoadingPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-rose-600 border-t-transparent" />
                  <p className="text-base font-semibold text-slate-700">
                    Memuat dan menganalisis halaman PDF...
                  </p>
                  {loadProgress && (
                    <p className="text-xs font-mono text-slate-400">
                      Merender thumbnail halaman {loadProgress.current} dari {loadProgress.total}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 group-hover:text-rose-600 transition">
                    Pilih File PDF untuk Dipisahkan
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 max-w-md">
                    Pilih file dokumen <code className="text-rose-700 font-semibold font-mono">.pdf</code>, seret & letakkan ke sini, atau tekan <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">Ctrl + V</kbd>.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Pisah per Rentang Kustom
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Ekstrak Halaman Terpilih
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Potong Setiap N Halaman
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
                    className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition-all hover:bg-rose-700 hover:shadow-xl group-hover:scale-105 cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Pilih File PDF Sekarang
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* KONDISI 2: File Telah Dimuat */}
        {inspectData && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Kolom Kiri: Pratinjau Grid Halaman Interaktif (WYSIWYG Sesuai Opsi) (lg:col-span-8) */}
            <div className="space-y-6 lg:col-span-8">
              {/* Header Dokumen Terbuka & Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-2xs">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900" title={inspectData.name}>
                      {inspectData.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{formatBytes(inspectData.size)}</span>
                      <span>•</span>
                      <span className="font-bold text-rose-700">
                        Total {inspectData.pageCount} Halaman
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetDocument}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition cursor-pointer"
                  >
                    Ganti PDF
                  </button>
                </div>
              </div>

              {/* BAR STATUS PILIHAN OPSI AKTIF (LIVE PRATINJAU STATUS) */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
                    Pratinjau Mode:
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                    <span className="text-slate-400 font-normal">Metode:</span>
                    <span className="text-rose-700">
                      {mode === 'range'
                        ? 'Rentang Kustom'
                        : mode === 'extract'
                        ? 'Ekstrak Halaman'
                        : 'Pisah Tiap N Halaman'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                    <span className="text-slate-400 font-normal">Hasil:</span>
                    <span className="text-emerald-700">
                      {projectedOutputFileCount} File PDF ({projectedOutputFileCount > 1 ? 'Arsip ZIP' : 'Langsung PDF'})
                    </span>
                  </span>
                </div>

                {/* Toolbar Pintasan Khusus Mode Ekstrak */}
                {mode === 'extract' && (
                  <div className="flex items-center gap-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={handleSelectAllPages}
                      className="rounded-lg px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectOddPages}
                      className="rounded-lg px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    >
                      Ganjil
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectEvenPages}
                      className="rounded-lg px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    >
                      Genap
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllPages}
                      className="rounded-lg px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* GRID THUMBNAIL SELURUH HALAMAN DOKUMEN DENGAN EFEK VISUAL WYSIWYG */}
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
                {inspectData.pages.map((p, pIdx) => {
                  const pageNum = p.pageNumber;

                  // 1. Kondisi Mode Rentang (Range)
                  let rangeBadgeInfo: {
                    color: ReturnType<typeof getColorByKey>;
                    rangeName: string;
                    label: string;
                  } | null = null;
                  let isIncludedInRange = false;

                  if (mode === 'range') {
                    const match = pageRangeMapping[pageNum];
                    if (match) {
                      isIncludedInRange = true;
                      const col = getColorByKey(match.range.colorKey);
                      rangeBadgeInfo = {
                        color: col,
                        rangeName: match.range.name || `Bagian ${match.index + 1}`,
                        label: `Rentang #${match.index + 1}`,
                      };
                    }
                  }

                  // 2. Kondisi Mode Ekstrak (Extract)
                  const isExtractSelected = mode === 'extract' && selectedPages.includes(pageNum);

                  // 3. Kondisi Mode Fixed (Pisah Tiap N Halaman)
                  const fixedChunk = mode === 'fixed'
                    ? fixedChunks.find((c) => pageNum >= c.startPage && pageNum <= c.endPage)
                    : null;
                  const isCutPoint = mode === 'fixed' && fixedChunk && pageNum === fixedChunk.endPage && pageNum < inspectData.pageCount;
                  const fixedChunkColor = fixedChunk ? getRangeColor(fixedChunk.chunkIndex - 1) : null;

                  return (
                    <div key={pageNum} className="contents">
                      <div
                        onClick={() => {
                          if (mode === 'extract') {
                            togglePageSelection(pageNum);
                          } else {
                            setLightboxPage(p);
                          }
                        }}
                        style={{
                          borderColor:
                            mode === 'range' && rangeBadgeInfo
                              ? rangeBadgeInfo.color.border
                              : mode === 'extract' && isExtractSelected
                              ? '#E11D48'
                              : mode === 'fixed' && fixedChunkColor
                              ? fixedChunkColor.border
                              : undefined,
                          backgroundColor:
                            mode === 'range' && rangeBadgeInfo
                              ? rangeBadgeInfo.color.bgLight
                              : mode === 'extract' && isExtractSelected
                              ? '#FFF1F2'
                              : mode === 'fixed' && fixedChunkColor
                              ? fixedChunkColor.bgLight
                              : '#FFFFFF',
                        }}
                        className={`group relative flex flex-col rounded-2xl border-2 p-2.5 shadow-2xs transition-all duration-200 select-none ${
                          mode === 'extract' ? 'cursor-pointer' : 'cursor-default'
                        } ${
                          mode === 'range' && !isIncludedInRange
                            ? 'opacity-40 grayscale-30 border-dashed border-slate-300'
                            : mode === 'extract' && !isExtractSelected
                            ? 'opacity-45 hover:opacity-80 border-slate-200'
                            : 'shadow-sm ring-2 ring-rose-500/10'
                        }`}
                      >
                        {/* Header Mini Kartu Halaman */}
                        <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-100/80 text-[10px]">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-900 font-mono font-bold text-white shadow-2xs">
                            {pageNum}
                          </span>

                          {/* Tombol Perbesar / Lightbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxPage(p);
                            }}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                            title="Perbesar tampilan halaman"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                          </button>
                        </div>

                        {/* Wadah Thumbnail Lembar Halaman */}
                        <div className="relative flex h-36 items-center justify-center rounded-xl bg-slate-50 p-1 overflow-hidden">
                          <div
                            style={{
                              aspectRatio: `${p.widthPt} / ${p.heightPt}`,
                            }}
                            className="relative flex h-full max-h-full max-w-full items-center justify-center overflow-hidden rounded bg-white shadow-2xs ring-1 ring-slate-200/80 transition-transform duration-200 group-hover:scale-[1.02]"
                          >
                            {p.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.thumbnailUrl}
                                alt={`Halaman ${pageNum}`}
                                draggable={false}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-rose-600" />
                            )}

                            {/* Badge Hamparan di Atas Thumbnail Sesuai Opsi */}
                            {mode === 'range' && rangeBadgeInfo && (
                              <div
                                style={{
                                  backgroundColor: rangeBadgeInfo.color.primary,
                                  color: '#FFFFFF',
                                }}
                                className="pointer-events-none absolute left-1 top-1 z-10 rounded px-1.5 py-0.5 text-[8px] font-bold shadow-2xs backdrop-blur-xs leading-none"
                              >
                                {rangeBadgeInfo.rangeName}
                              </div>
                            )}

                            {mode === 'extract' && isExtractSelected && (
                              <div className="pointer-events-none absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-md ring-2 ring-white">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}

                            {mode === 'fixed' && fixedChunk && (
                              <div
                                style={{
                                  backgroundColor: fixedChunkColor?.primary,
                                  color: '#FFFFFF',
                                }}
                                className="pointer-events-none absolute left-1 top-1 z-10 rounded px-1.5 py-0.5 text-[8px] font-bold shadow-2xs backdrop-blur-xs leading-none"
                              >
                                File #{fixedChunk.chunkIndex}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer Status Kartu Halaman */}
                        <div className="mt-2 text-center text-[10px]">
                          {mode === 'range' && (
                            <span
                              style={{
                                color: rangeBadgeInfo ? rangeBadgeInfo.color.text : '#94A3B8',
                              }}
                              className="font-bold truncate block"
                            >
                              {rangeBadgeInfo ? rangeBadgeInfo.rangeName : 'Diabaikan'}
                            </span>
                          )}

                          {mode === 'extract' && (
                            <span
                              className={`font-bold block ${
                                isExtractSelected ? 'text-rose-700' : 'text-slate-400'
                              }`}
                            >
                              {isExtractSelected ? '✓ Diekstrak' : 'Tidak Dipilih'}
                            </span>
                          )}

                          {mode === 'fixed' && fixedChunk && (
                            <span
                              style={{ color: fixedChunkColor?.text }}
                              className="font-bold block"
                            >
                              File #{fixedChunk.chunkIndex} (Hal {fixedChunk.startPage}–{fixedChunk.endPage})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* INDIKATOR TITIK POTONG GUNTING PISAH N HALAMAN (SCISSOR CUT LINE) */}
                      {isCutPoint && (
                        <div className="col-span-full my-2 flex items-center gap-3">
                          <div className="h-px flex-1 border-t-2 border-dashed border-rose-300" />
                          <div className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-bold text-rose-700 shadow-2xs">
                            <span>✂️</span>
                            <span>Titik Potong PDF (Batas File #{fixedChunk.chunkIndex})</span>
                          </div>
                          <div className="h-px flex-1 border-t-2 border-dashed border-rose-300" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kolom Kanan: Panel Opsi Pemisahan Interaktif & Tombol Eksekusi (lg:col-span-4) */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-6 sticky top-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Opsi Pemisahan Dokumen
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Tentukan cara Anda ingin membagi dokumen PDF ini
                  </p>
                </div>

                {/* 1. Pemilih Mode Pemisahan (Tab Segmented) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Metode Pemisahan
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setMode('range')}
                      className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition cursor-pointer select-none ${
                        mode === 'range'
                          ? 'border border-rose-200 bg-white font-bold text-rose-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="text-xs">Rentang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('extract')}
                      className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition cursor-pointer select-none ${
                        mode === 'extract'
                          ? 'border border-rose-200 bg-white font-bold text-rose-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="text-xs">Ekstrak</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('fixed')}
                      className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition cursor-pointer select-none ${
                        mode === 'fixed'
                          ? 'border border-rose-200 bg-white font-bold text-rose-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="text-xs">Tiap N Hal</span>
                    </button>
                  </div>
                </div>

                {/* PANEL DETAIL SESUAI MODE */}
                {/* MODE 1: PISAH BERDASARKAN RENTANG HALAMAN */}
                {mode === 'range' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Daftar Rentang Halaman ({ranges.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleAddRange}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                      >
                        <span className="text-sm leading-none">+</span>
                        <span>Tambah Rentang</span>
                      </button>
                    </div>

                    <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
                      {ranges.map((rng, rIdx) => {
                        const col = getColorByKey(rng.colorKey);
                        return (
                          <div
                            key={rng.id}
                            style={{
                              borderColor: col.border,
                              backgroundColor: `${col.bgLight}90`,
                            }}
                            className="rounded-2xl border p-3 space-y-2 transition-all duration-200 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span
                                  style={{ backgroundColor: col.primary }}
                                  className="h-2.5 w-2.5 rounded-full"
                                />
                                <input
                                  type="text"
                                  value={rng.name}
                                  onChange={(e) => handleUpdateRange(rng.id, { name: e.target.value })}
                                  placeholder={`Bagian ${rIdx + 1}`}
                                  className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-bold text-slate-800 focus:border-slate-300 focus:bg-white focus:outline-none"
                                />
                              </div>

                              {ranges.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRange(rng.id)}
                                  className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-700 transition cursor-pointer"
                                  title="Hapus rentang ini"
                                >
                                  ✕
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                              <div className="flex-1">
                                <label className="text-[10px] font-medium text-slate-500">Dari Halaman</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={inspectData.pageCount}
                                  value={rng.fromPage}
                                  onChange={(e) =>
                                    handleUpdateRange(rng.id, {
                                      fromPage: Math.max(1, Math.min(inspectData.pageCount, parseInt(e.target.value, 10) || 1)),
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:border-rose-400 focus:outline-none"
                                />
                              </div>
                              <span className="text-slate-400 mt-3">—</span>
                              <div className="flex-1">
                                <label className="text-[10px] font-medium text-slate-500">Sampai Halaman</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={inspectData.pageCount}
                                  value={rng.toPage}
                                  onChange={(e) =>
                                    handleUpdateRange(rng.id, {
                                      toPage: Math.max(1, Math.min(inspectData.pageCount, parseInt(e.target.value, 10) || 1)),
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:border-rose-400 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Opsi Penggabungan Semua Rentang */}
                    <div
                      className={`rounded-2xl border p-3 transition-colors ${
                        mergeRangesIntoOne
                          ? 'border-rose-300 bg-rose-50/80 text-rose-950 ring-1 ring-rose-500/20'
                          : 'border-slate-200 bg-slate-50/60 text-slate-700'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mergeRangesIntoOne}
                          onChange={(e) => setMergeRangesIntoOne(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                        <span>Gabungkan Semua Rentang Jadi 1 File PDF</span>
                      </label>
                      <p className="mt-1 text-[10px] text-slate-500 pl-6.5">
                        {mergeRangesIntoOne
                          ? 'Menghasilkan 1 file PDF baru yang hanya memuat halaman dari rentang di atas.'
                          : 'Masing-masing rentang diekspor sebagai file PDF terpisah (diunduh dalam file ZIP).'}
                      </p>
                    </div>
                  </div>
                )}

                {/* MODE 2: EKSTRAK HALAMAN TERTENTU */}
                {mode === 'extract' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Ketik Daftar Halaman yang Ingin Diekstrak
                      </label>
                      <input
                        type="text"
                        value={extractTextInput}
                        onChange={(e) => handleExtractTextInputChange(e.target.value)}
                        placeholder="Contoh: 1, 3-5, 8"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-mono font-bold text-slate-800 transition focus:border-rose-500 focus:bg-white focus:outline-none"
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Klik gambar di kiri untuk pilih/batal</span>
                        <span className="font-bold text-rose-700">
                          {selectedPages.length} dari {inspectData.pageCount} Hal
                        </span>
                      </div>
                    </div>

                    {/* Format Ekstraksi */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Format File Hasil Ekstraksi
                      </label>
                      <div className="space-y-2">
                        <label
                          className={`flex items-start gap-2.5 rounded-2xl border p-3 cursor-pointer transition ${
                            mergeExtractedIntoOne
                              ? 'border-rose-600 bg-rose-50 text-rose-950 font-bold ring-2 ring-rose-500/20'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="extract-mode"
                            checked={mergeExtractedIntoOne}
                            onChange={() => setMergeExtractedIntoOne(true)}
                            className="mt-0.5 h-3.5 w-3.5 text-rose-600 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs block">Gabungkan Jadi 1 File PDF</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              Semua halaman terpilih dirangkai ke dalam 1 dokumen utuh.
                            </span>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-2.5 rounded-2xl border p-3 cursor-pointer transition ${
                            !mergeExtractedIntoOne
                              ? 'border-rose-600 bg-rose-50 text-rose-950 font-bold ring-2 ring-rose-500/20'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="extract-mode"
                            checked={!mergeExtractedIntoOne}
                            onChange={() => setMergeExtractedIntoOne(false)}
                            className="mt-0.5 h-3.5 w-3.5 text-rose-600 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs block">Pisah Tiap Halaman Jadi File Terpisah</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              Setiap halaman terpilih menjadi 1 file PDF tersendiri (diunduh via ZIP).
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODE 3: PISAH SETIAP N HALAMAN */}
                {mode === 'fixed' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold uppercase tracking-wider text-slate-700">
                          Bagi Setiap Berapa Halaman?
                        </label>
                        <span className="rounded-lg bg-rose-50 px-2.5 py-0.5 font-mono font-bold text-rose-700 border border-rose-200">
                          Setiap {fixedPagesPerSplit} Halaman
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={1}
                          max={Math.max(1, inspectData.pageCount)}
                          value={fixedPagesPerSplit}
                          onChange={(e) => setFixedPagesPerSplit(parseInt(e.target.value, 10) || 1)}
                          className="h-2 w-full cursor-pointer accent-rose-600"
                        />
                        <input
                          type="number"
                          min={1}
                          max={inspectData.pageCount}
                          value={fixedPagesPerSplit}
                          onChange={(e) =>
                            setFixedPagesPerSplit(
                              Math.max(1, Math.min(inspectData.pageCount, parseInt(e.target.value, 10) || 1))
                            )
                          }
                          className="w-16 rounded-xl border border-slate-200 bg-white p-2 text-center font-mono font-bold text-slate-800 text-xs focus:border-rose-400 focus:outline-none"
                        />
                      </div>

                      <p className="text-[11px] text-slate-500">
                        Dokumen dengan {inspectData.pageCount} halaman akan dipotong menjadi{' '}
                        <strong className="text-rose-700 font-bold">{fixedChunks.length} file PDF terpisah</strong>.
                      </p>
                    </div>

                    {/* Rincian Potongan File yang Akan Dihasilkan */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5 max-h-40 overflow-y-auto">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Daftar Berkas yang Akan Dibuat:
                      </span>
                      {fixedChunks.map((chunk) => (
                        <div key={chunk.chunkIndex} className="flex items-center justify-between text-xs text-slate-700">
                          <span className="font-semibold">File #{chunk.chunkIndex}</span>
                          <span className="font-mono text-[11px] text-rose-700">
                            Hal {chunk.startPage} – {chunk.endPage}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Nama File Output */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nama Dasar File Output
                  </label>
                  <input
                    type="text"
                    value={outputBaseName}
                    onChange={(e) => setOutputBaseName(e.target.value)}
                    placeholder="nama-dokumen-pisah"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold text-slate-800 transition focus:border-rose-500 focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Indikator Progres Pemisahan */}
                {isSplitting && splitProgress && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                      <span>Memproses Berkas {splitProgress.current} dari {splitProgress.total}...</span>
                      <span>{Math.round((splitProgress.current / splitProgress.total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-rose-200">
                      <div
                        className="h-full bg-rose-600 transition-all duration-200"
                        style={{
                          width: `${(splitProgress.current / splitProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Pesan Kesalahan */}
                {splitError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                    <span className="font-bold">Gagal: </span>
                    {splitError}
                  </div>
                )}

                {/* Tombol CTA Utama (Crimson Rose Menonjol & Jelas) */}
                <button
                  type="button"
                  onClick={handleStartSplit}
                  disabled={isSplitting || projectedOutputFileCount === 0}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all duration-200 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isSplitting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Memisahkan PDF...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                      </svg>
                      <span>
                        Pisahkan PDF Sekarang ({projectedOutputFileCount} Berkas)
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

        {/* HASIL PEMISAHAN SELESAI */}
        {result && primaryDownloadUrl && (
          <div className="mt-8 rounded-3xl border border-rose-200 bg-white p-6 sm:p-8 shadow-xl shadow-rose-500/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/30">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full uppercase">
                      Pemisahan PDF Berhasil
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {formatBytes(result.primaryBlob.size)}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    {result.primaryFileName}
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!result.isZip && (
                  <a
                    href={primaryDownloadUrl}
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
                  href={primaryDownloadUrl}
                  download={result.primaryFileName}
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-7 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_rgba(225,29,72,0.45)] transition-all cursor-pointer"
                >
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>
                    {result.isZip ? 'Unduh Semua Berkas (ZIP)' : 'Unduh Berkas PDF'}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={clearResultUrls}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                  title="Tutup banner hasil"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Statistik Hasil Pemisahan */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Jumlah File Dihasilkan</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {result.totalFiles} Dokumen
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Total Halaman Terproses</div>
                <div className="text-2xl font-black text-rose-700 mt-1">
                  {result.totalPages} Halaman
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Format Paket Unduhan</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {result.isZip ? 'Arsip ZIP' : 'Dokumen PDF'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Ukuran Total File</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {formatBytes(result.primaryBlob.size)}
                </div>
              </div>
            </div>

            {/* Daftar Rincian File Hasil & Tombol Unduh Satuan */}
            {result.outputFiles.length > 1 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Unduh Berkas Terpisah Secara Individu:
                </h4>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {result.outputFiles.map((fileItem, fIdx) => {
                    const u = fileDownloadUrls[fileItem.fileName];
                    return (
                      <div
                        key={fIdx}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 hover:bg-white hover:shadow-xs transition"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-slate-800" title={fileItem.fileName}>
                            {fileItem.fileName}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {fileItem.pageLabel} • {formatBytes(fileItem.sizeBytes)}
                          </div>
                        </div>

                        {u && (
                          <a
                            href={u}
                            download={fileItem.fileName}
                            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition shadow-2xs cursor-pointer"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Unduh</span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                  {lightboxPage.widthPt} × {lightboxPage.heightPt} pt
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

            <div className="mt-4 flex w-full items-center justify-end">
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

