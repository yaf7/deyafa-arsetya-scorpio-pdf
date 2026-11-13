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
  COMPRESSION_PRESETS,
  CompressionLevel,
  CompressPageThumbnail,
  CompressPdfOptions,
  executeCompressPdf,
  formatBytes,
  GeneratedCompressResult,
  inspectPdfForCompress,
  InspectCompressPdfResult,
  sanitizePdfFilename,
  stripPdfExtension,
} from '@/app/lib/compress-pdf';
import { Navbar } from './Navbar';

export function CompressPdfWorkspace() {
  const [inspectData, setInspectData] = useState<InspectCompressPdfResult | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<{ current: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Status Drag & Drop File
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Opsi Kompresi
  const [level, setLevel] = useState<CompressionLevel>('recommended');
  const [customQuality, setCustomQuality] = useState<number>(0.65);
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [removeMetadata, setRemoveMetadata] = useState<boolean>(true);
  const [outputName, setOutputName] = useState<string>('');

  // Mode Tampilan Pratinjau: 'grid' (semua halaman) atau 'compare' (bandingkan sebelum & sesudah)
  const [previewViewMode, setPreviewViewMode] = useState<'grid' | 'compare'>('grid');

  // Status Eksekusi Kompresi
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressProgress, setCompressProgress] = useState<{ current: number; total: number } | null>(null);
  const [compressError, setCompressError] = useState<string | null>(null);

  // Hasil Kompresi
  const [result, setResult] = useState<GeneratedCompressResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Lightbox Pratinjau Halaman
  const [lightboxPage, setLightboxPage] = useState<CompressPageThumbnail | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeThumbUrlsRef = useRef<Set<string>>(new Set());
  const activeResultUrlRef = useRef<string | null>(null);

  // Bersihkan Object URLs saat unmount
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

  // Tutup lightbox dengan tombol Escape
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

  const handleSelectFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setLoadError('Pilih file dokumen PDF yang valid (.pdf).');
        return;
      }

      setLoadError(null);
      setCompressError(null);
      clearResult();
      setIsLoadingPdf(true);
      setLoadProgress({ current: 0, total: 1 });

      try {
        const inspected = await inspectPdfForCompress(file, (loaded, total) => {
          setLoadProgress({ current: loaded, total });
        });

        inspected.pages.forEach((p) => {
          if (p.thumbnailUrl) activeThumbUrlsRef.current.add(p.thumbnailUrl);
        });

        setInspectData(inspected);
        setOutputName(`${stripPdfExtension(file.name)}-terkompresi`);
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
    [clearResult]
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

  // Reset Dokumen
  const handleResetDocument = () => {
    clearResult();
    activeThumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    activeThumbUrlsRef.current.clear();
    setInspectData(null);
    setLoadError(null);
    setCompressError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Estimasi Pengurangan Ukuran dan Ukuran File Akhir (Dihitung Secara Real-Time)
  const estimatedStats = useMemo(() => {
    if (!inspectData) {
      return {
        estimatedSizeBytes: 0,
        estimatedReductionPercent: 0,
        label: '',
      };
    }

    const origSize = inspectData.size;
    let baseRatio = 0.55; // 45% dari ukuran asli

    if (level === 'extreme') {
      baseRatio = 0.25; // 75% penghematan
    } else if (level === 'recommended') {
      baseRatio = 0.45; // 55% penghematan
    } else if (level === 'light') {
      baseRatio = 0.70; // 30% penghematan
    } else if (level === 'custom') {
      baseRatio = Math.max(0.15, Math.min(0.90, customQuality * 0.75 + 0.1));
    }

    // Jika opsi grayscale aktif, ukuran berkurang ~25% lagi
    if (grayscale) {
      baseRatio *= 0.75;
    }

    const estBytes = Math.round(origSize * baseRatio);
    const estReduction = Math.round((1 - baseRatio) * 100);

    return {
      estimatedSizeBytes: estBytes,
      estimatedReductionPercent: estReduction,
      label: `~${estReduction}% lebih hemat`,
    };
  }, [inspectData, level, customQuality, grayscale]);

  // Eksekusi Kompresi PDF
  const handleStartCompress = async () => {
    if (!inspectData) return;

    setCompressError(null);
    clearResult();
    setIsCompressing(true);
    setCompressProgress({ current: 0, total: inspectData.pageCount });

    try {
      const options: CompressPdfOptions = {
        level,
        customQuality,
        grayscale,
        removeMetadata,
        outputName,
      };

      const res = await executeCompressPdf(inspectData, options, (current, total) => {
        setCompressProgress({ current, total });
      });

      const url = URL.createObjectURL(res.blob);
      activeResultUrlRef.current = url;
      setResultUrl(url);
      setResult(res);
    } catch (err) {
      setCompressError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mengompresi file PDF. Pastikan dokumen tidak terkunci.'
      );
    } finally {
      setIsCompressing(false);
      setCompressProgress(null);
    }
  };

  const activePreset = COMPRESSION_PRESETS[level];

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
          <span className="text-slate-400">OPTIMALKAN PDF</span>
          <span>/</span>
          <span className="font-bold text-slate-900">Kompres PDF</span>
        </div>

        {/* Hero Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/80 px-3.5 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider shadow-2xs">
            <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            OPTIMALKAN PDF • Perkecil Ukuran Dokumen
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">
            Kompres <span className="text-emerald-600">File PDF</span> Jadi Super Ringan
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Perkecil ukuran dokumen PDF Anda secara drastis untuk upload CPNS, BUMN, email, atau portal kerja. Pilih tingkat kompresi, opsi skala abu-abu (grayscale), dan pantau estimasi ukuran secara langsung.
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
                  ? 'border-emerald-500 bg-emerald-50/60 shadow-2xl scale-[1.01]'
                  : 'border-slate-300/80 bg-white/90 shadow-xl shadow-slate-200/50 hover:border-emerald-400 hover:bg-white hover:shadow-2xl hover:scale-[1.005]'
              }`}
            >
              {/* Icon Visual */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 transition-transform duration-300 group-hover:scale-110">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md border-2 border-white">
                  <span className="text-[11px] font-extrabold">⚡</span>
                </div>
              </div>

              {isLoadingPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
                  <p className="text-base font-semibold text-slate-700">
                    Memuat dan menganalisis dokumen PDF...
                  </p>
                  {loadProgress && (
                    <p className="text-xs font-mono text-slate-400">
                      Merender halaman {loadProgress.current} dari {loadProgress.total}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 group-hover:text-emerald-600 transition">
                    Pilih File PDF yang Ingin Dikompres
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 max-w-md">
                    Pilih file <code className="text-emerald-700 font-semibold font-mono">.pdf</code>, seret & letakkan ke sini, atau tekan <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">Ctrl + V</kbd>.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Hemat Hingga 85% Ukuran File
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Opsi Skala Abu-Abu (Grayscale)
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Cocok untuk CPNS / BUMN
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
              {/* Header Dokumen Terbuka & Meteran Ukuran Visual */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-2xs">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900" title={inspectData.name}>
                      {inspectData.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Ukuran Asli: <strong className="font-semibold text-slate-800">{formatBytes(inspectData.size)}</strong></span>
                      <span>•</span>
                      <span className="font-bold text-emerald-700">
                        Total {inspectData.pageCount} Halaman
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mode Tampilan Switcher */}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold text-slate-700 mr-1">
                    <button
                      type="button"
                      onClick={() => setPreviewViewMode('grid')}
                      className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                        previewViewMode === 'grid'
                          ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua Halaman
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewMode('compare')}
                      className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                        previewViewMode === 'compare'
                          ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bandingkan
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetDocument}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition cursor-pointer"
                  >
                    Ganti PDF
                  </button>
                </div>
              </div>

              {/* METERAN VISUAL ESTIMASI PENGURANGAN UKURAN (LIVE INTERACTIVE GAUGE) */}
              <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      Simulasi Ukuran Dokumen:
                    </span>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      Hemat {estimatedStats.estimatedReductionPercent}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400">
                      Asli: <strong className="font-mono text-slate-700">{formatBytes(inspectData.size)}</strong>
                    </span>
                    <span className="text-slate-300">➔</span>
                    <span className="text-emerald-700 font-bold">
                      Perkiraan: <strong className="font-mono text-base">{formatBytes(estimatedStats.estimatedSizeBytes)}</strong>
                    </span>
                  </div>
                </div>

                {/* Bar Perbandingan Visual */}
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80">
                  <div
                    style={{
                      width: `${100 - estimatedStats.estimatedReductionPercent}%`,
                      backgroundColor: activePreset.accentColor,
                    }}
                    className="h-full rounded-full transition-all duration-300 shadow-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>
                    Tingkat: <strong className="font-bold text-slate-800">{activePreset.name}</strong>
                  </span>
                  <span>
                    Mode Warna: <strong className="font-bold text-slate-800">{grayscale ? 'Hitam-Putih (Grayscale)' : 'Warna Asli'}</strong>
                  </span>
                  <span>
                    Pembersihan Metadata: <strong className="font-bold text-slate-800">{removeMetadata ? 'Aktif' : 'Nonaktif'}</strong>
                  </span>
                </div>
              </div>

              {/* TAMPILAN 1: GRID SELURUH HALAMAN (LIVE GRAYSCALE & STATUS BADGES) */}
              {previewViewMode === 'grid' && (
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
                  {inspectData.pages.map((p) => {
                    return (
                      <div
                        key={p.pageNumber}
                        onClick={() => setLightboxPage(p)}
                        className="group relative flex flex-col rounded-2xl border-2 border-slate-200/90 bg-white p-2.5 shadow-2xs transition-all duration-200 hover:border-emerald-300 hover:shadow-md cursor-pointer select-none"
                      >
                        {/* Header Mini Kartu Halaman */}
                        <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-100 text-[10px]">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-900 font-mono font-bold text-white shadow-2xs">
                            {p.pageNumber}
                          </span>

                          <span
                            style={{ color: activePreset.accentColor }}
                            className="font-bold text-[9px]"
                          >
                            {activePreset.badge}
                          </span>
                        </div>

                        {/* Wadah Thumbnail Lembar Halaman (Live Grayscale Filter Reactivity) */}
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
                                alt={`Halaman ${p.pageNumber}`}
                                draggable={false}
                                style={{
                                  filter: grayscale ? 'grayscale(100%)' : 'none',
                                }}
                                className="h-full w-full object-contain transition-all duration-300"
                              />
                            ) : (
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
                            )}

                            {/* Tag Status Hamparan di Atas Thumbnail */}
                            <div className="pointer-events-none absolute left-1 top-1 z-10 flex flex-col gap-0.5">
                              {grayscale && (
                                <span className="rounded bg-slate-900/85 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-2xs backdrop-blur-xs leading-none">
                                  B&W
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Footer Status Kartu Halaman */}
                        <div className="mt-2 text-center text-[10px]">
                          <span className="font-semibold text-slate-500">
                            Hal {p.pageNumber} dari {inspectData.pageCount}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAMPILAN 2: MODE PERBANDINGAN VISUAL SEBELUM & SESUDAH (COMPARE VIEW) */}
              {previewViewMode === 'compare' && inspectData.pages.length > 0 && (
                <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Perbandingan Visual: Halaman 1 (Sebelum vs Sesudah)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Lihat bagaimana dokumen asli akan terlihat setelah kompresi dan penerapan filter
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Sisi Kiri: Sebelum Kompresi */}
                    <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3 text-center">
                      <div className="flex items-center justify-between text-xs">
                        <span className="rounded-full bg-slate-200 px-3 py-1 font-bold text-slate-700">
                          Sebelum (Dokumen Asli)
                        </span>
                        <span className="font-mono font-bold text-slate-600">
                          {formatBytes(inspectData.size)}
                        </span>
                      </div>

                      <div className="flex h-72 items-center justify-center overflow-hidden rounded-xl bg-white p-2 shadow-xs">
                        {inspectData.pages[0].thumbnailUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={inspectData.pages[0].thumbnailUrl}
                            alt="Dokumen Asli"
                            className="max-h-full w-auto object-contain"
                          />
                        )}
                      </div>

                      <span className="text-[11px] text-slate-500 block">
                        Kualitas visual 100% tanpa kompresi
                      </span>
                    </div>

                    {/* Sisi Kanan: Sesudah Kompresi (Live Filter Grayscale & Estimasi) */}
                    <div
                      style={{ borderColor: activePreset.accentColor }}
                      className="rounded-2xl border-2 bg-emerald-50/40 p-4 space-y-3 text-center transition-all duration-300"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          style={{
                            backgroundColor: activePreset.accentColor,
                            color: '#FFFFFF',
                          }}
                          className="rounded-full px-3 py-1 font-bold shadow-2xs"
                        >
                          Sesudah ({activePreset.name})
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          ~{formatBytes(estimatedStats.estimatedSizeBytes)} (-{estimatedStats.estimatedReductionPercent}%)
                        </span>
                      </div>

                      <div className="flex h-72 items-center justify-center overflow-hidden rounded-xl bg-white p-2 shadow-xs">
                        {inspectData.pages[0].thumbnailUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={inspectData.pages[0].thumbnailUrl}
                            alt="Hasil Kompresi"
                            style={{
                              filter: grayscale ? 'grayscale(100%)' : 'none',
                            }}
                            className="max-h-full w-auto object-contain transition-all duration-300"
                          />
                        )}
                      </div>

                      <span className="text-[11px] font-bold text-emerald-800 block">
                        {grayscale ? 'Skala Abu-Abu (Grayscale) • ' : ''}Kompresi {activePreset.estimatedReduction}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Kolom Kanan: Pengaturan Tingkat Kompresi & Tombol Aksi (lg:col-span-4) */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-6 sticky top-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Opsi Kompresi Dokumen
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesuaikan tingkat pengecilan ukuran dan kualitas visual
                  </p>
                </div>

                {/* 1. Pemilihan Tingkat Kompresi */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Tingkat Kompresi
                  </label>
                  <div className="space-y-2">
                    {(Object.keys(COMPRESSION_PRESETS) as CompressionLevel[]).map((lvlKey) => {
                      const item = COMPRESSION_PRESETS[lvlKey];
                      const isSelected = level === lvlKey;

                      const activeStyle =
                        lvlKey === 'extreme'
                          ? 'border-rose-600 bg-rose-50/80 text-rose-950 font-bold ring-2 ring-rose-500/25 shadow-sm'
                          : lvlKey === 'recommended'
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold ring-2 ring-emerald-500/25 shadow-sm'
                          : lvlKey === 'light'
                          ? 'border-blue-600 bg-blue-50/80 text-blue-950 font-bold ring-2 ring-blue-500/25 shadow-sm'
                          : 'border-purple-600 bg-purple-50/80 text-purple-950 font-bold ring-2 ring-purple-500/25 shadow-sm';

                      return (
                        <div
                          key={lvlKey}
                          onClick={() => setLevel(lvlKey)}
                          className={`cursor-pointer rounded-2xl border-2 p-3 transition-all duration-200 select-none ${
                            isSelected
                              ? activeStyle
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              {isSelected && (
                                <svg
                                  className="h-3.5 w-3.5"
                                  style={{ color: item.accentColor }}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              <span className="text-xs font-bold text-slate-900">
                                {item.name}
                              </span>
                            </div>
                            <span
                              style={{
                                backgroundColor: isSelected ? item.accentColor : '#F1F5F9',
                                color: isSelected ? '#FFFFFF' : '#475569',
                              }}
                              className="rounded-full px-2 py-0.5 text-[9px] font-bold transition-colors"
                            >
                              {item.estimatedReduction}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            {item.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Slider Kustom Jika Memilih Mode Kustom */}
                {level === 'custom' && (
                  <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-900">Kualitas Gambar:</span>
                      <span className="font-mono font-bold text-purple-700">
                        {Math.round(customQuality * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={0.95}
                      step={0.05}
                      value={customQuality}
                      onChange={(e) => setCustomQuality(parseFloat(e.target.value))}
                      className="h-2 w-full cursor-pointer accent-purple-600"
                    />
                    <div className="flex justify-between text-[9px] text-purple-600">
                      <span>Ukuran Terkecil (20%)</span>
                      <span>Kualitas Tertinggi (95%)</span>
                    </div>
                  </div>
                )}

                {/* 2. Opsi Pengoptimalan Tambahan */}
                <div className="space-y-2.5 pt-1 border-t border-slate-100">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Opsi Tambahan
                  </label>

                  {/* Konversi ke Grayscale (Hitam Putih) */}
                  <div
                    className={`rounded-2xl border p-3 transition-colors ${
                      grayscale
                        ? 'border-emerald-300 bg-emerald-50/80 text-emerald-950 ring-1 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50/60 text-slate-700'
                    }`}
                  >
                    <label className="flex items-start gap-2.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={grayscale}
                        onChange={(e) => setGrayscale(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <span className="block">Ubah ke Hitam-Putih (Grayscale)</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          Menghemat ukuran hingga ~25% ekstra. Tampilan di pratinjau langsung berubah!
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Bersihkan Metadata */}
                  <div
                    className={`rounded-2xl border p-3 transition-colors ${
                      removeMetadata
                        ? 'border-slate-300 bg-slate-50/80 text-slate-900 ring-1 ring-slate-400/20'
                        : 'border-slate-200 bg-slate-50/60 text-slate-700'
                    }`}
                  >
                    <label className="flex items-start gap-2.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={removeMetadata}
                        onChange={(e) => setRemoveMetadata(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500 cursor-pointer"
                      />
                      <div>
                        <span className="block">Hapus Metadata Dokumen</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          Menghilangkan info riwayat pembuat, metadata XML, dan data privat tersembunyi.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 3. Nama File Output */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nama File PDF Terkompresi
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="dokumen-terkompresi"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-12 text-xs font-semibold text-slate-800 transition focus:border-emerald-500 focus:bg-white focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-xs font-bold text-emerald-700">
                      .pdf
                    </span>
                  </div>
                </div>

                {/* Indikator Progres Kompresi */}
                {isCompressing && compressProgress && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                      <span>Mengompresi Halaman {compressProgress.current} dari {compressProgress.total}...</span>
                      <span>{Math.round((compressProgress.current / compressProgress.total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-200"
                        style={{
                          width: `${(compressProgress.current / compressProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Pesan Kesalahan */}
                {compressError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                    <span className="font-bold">Gagal: </span>
                    {compressError}
                  </div>
                )}

                {/* Tombol CTA Utama (Crimson Red Menonjol & Jelas) */}
                <button
                  type="button"
                  onClick={handleStartCompress}
                  disabled={isCompressing}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all duration-200 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isCompressing ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Mengompresi Dokumen PDF...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <span>
                        Kompres PDF Sekarang ({estimatedStats.label})
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

        {/* HASIL KOMPRESI SELESAI */}
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
                      Kompresi Berhasil
                    </span>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Hemat {result.reductionPercentage}%
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    {result.fileName}
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
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
                <a
                  href={resultUrl}
                  download={result.fileName}
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-7 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_rgba(225,29,72,0.45)] transition-all cursor-pointer"
                >
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Unduh File PDF Terkompresi</span>
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

            {/* Statistik Hasil Kompresi */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Ukuran Dokumen Asli</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {formatBytes(result.originalSizeBytes)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Ukuran Setelah Kompresi</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">
                  {formatBytes(result.compressedSizeBytes)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Ruang yang Dihemat</div>
                <div className="text-2xl font-black text-rose-700 mt-1">
                  {formatBytes(result.savedBytes)} ({result.reductionPercentage}%)
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Jumlah Halaman</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {result.pageCount} Halaman
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
                  Pratinjau Halaman {lightboxPage.pageNumber} ({grayscale ? 'Skala Abu-Abu' : 'Berwarna'})
                </h3>
                <p className="text-xs text-slate-500">
                  {lightboxPage.widthPt} × {lightboxPage.heightPt} pt • Preset: {activePreset.name}
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
                  style={{
                    filter: grayscale ? 'grayscale(100%)' : 'none',
                  }}
                  className="max-h-[66vh] w-auto rounded-lg shadow-md object-contain transition-all duration-300"
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

