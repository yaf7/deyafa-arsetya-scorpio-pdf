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
  convertPdfToPdfa,
  formatBytes,
  GeneratedPdfaResult,
  inspectPdfForPdfa,
  PDFA_COLOR_PROFILES,
  PDFA_STANDARDS,
  PdfaColorProfile,
  PdfaInspectResult,
  PdfaStandard,
  sanitizePdfFilename,
  stripPdfExtension,
} from '@/app/lib/pdf-to-pdfa';
import { Navbar } from './Navbar';

export function PdfToPdfaWorkspace() {
  // Berkas sumber
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspectData, setInspectData] = useState<PdfaInspectResult | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Opsi Konversi PDF/A
  const [standard, setStandard] = useState<PdfaStandard>('pdfa-1b');
  const [colorProfile, setColorProfile] = useState<PdfaColorProfile>('sRGB');
  const [outputName, setOutputName] = useState<string>('');
  const [removeScripts, setRemoveScripts] = useState<boolean>(true);
  const [removeEncryption, setRemoveEncryption] = useState<boolean>(true);
  const [embedXmpMetadata, setEmbedXmpMetadata] = useState<boolean>(true);
  const [embedOutputIntent, setEmbedOutputIntent] = useState<boolean>(true);

  // Status Konversi
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [convertStatus, setConvertStatus] = useState<{ step: number; total: number; message: string } | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Hasil Konversi
  const [result, setResult] = useState<GeneratedPdfaResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Drag & Drop
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Modal zoom pratinjau halaman
  const [activePreviewPage, setActivePreviewPage] = useState<number | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeResultUrlRef = useRef<string | null>(null);
  const activeThumbnailsRef = useRef<string[]>([]);

  // Bersihkan URLs saat unmount
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

  // Proses Pemilihan Berkas PDF
  const handleSelectFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setLoadError('Pilih file berkas berformat PDF yang valid (.pdf).');
        return;
      }

      setLoadError(null);
      setConvertError(null);
      clearResult();

      // Bersihkan thumbnail sebelumnya
      activeThumbnailsRef.current.forEach((url) => URL.revokeObjectURL(url));
      activeThumbnailsRef.current = [];

      setIsLoadingPdf(true);
      setSelectedFile(file);
      setOutputName(`${stripPdfExtension(file.name)}-pdfa`);

      try {
        const inspected = await inspectPdfForPdfa(file, (loaded, total) => {
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
            : 'Gagal memuat dan menganalisis berkas PDF. Pastikan file tidak rusak atau terlindungi sandi.'
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

  // Reset Dokumen
  const handleResetDocument = () => {
    clearResult();
    activeThumbnailsRef.current.forEach((url) => URL.revokeObjectURL(url));
    activeThumbnailsRef.current = [];
    setSelectedFile(null);
    setInspectData(null);
    setLoadError(null);
    setConvertError(null);
    setOutputName('');
    setActivePreviewPage(null);
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

  // Eksekusi Konversi PDF ke PDF/A
  const handleStartConversion = async () => {
    if (!selectedFile) return;

    setConvertError(null);
    clearResult();
    setIsConverting(true);
    setConvertStatus({ step: 1, total: 5, message: 'Menyiapkan dokumen...' });

    try {
      const generated = await convertPdfToPdfa(
        selectedFile,
        {
          standard,
          colorProfile,
          outputName: outputName || `${stripPdfExtension(selectedFile.name)}-pdfa`,
          removeScripts,
          removeEncryption,
          embedXmpMetadata,
          embedOutputIntent,
        },
        (step, total, message) => {
          setConvertStatus({ step, total, message });
        }
      );

      const url = URL.createObjectURL(generated.blob);
      activeResultUrlRef.current = url;
      setResultUrl(url);
      setResult(generated);
    } catch (err) {
      setConvertError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mengonversi dokumen ke format PDF/A.'
      );
    } finally {
      setIsConverting(false);
      setConvertStatus(null);
    }
  };

  const currentStandardConfig = PDFA_STANDARDS[standard];

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
        aria-label="Pilih dokumen PDF"
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
            <span className="text-slate-400">KONVERSI DARI PDF</span>
            <span>/</span>
            <span className="font-bold text-slate-900">PDF ke PDF/A</span>
          </div>

          {/* Indikator Berkas Saat Dokumen Sudah Dimuat */}
          {inspectData && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-2xs border border-slate-200">
                <span className="text-indigo-600 font-extrabold">🏛️</span>
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
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/90 bg-indigo-50/80 px-3.5 py-1 text-xs font-bold text-indigo-800 uppercase tracking-wider shadow-2xs">
            <svg className="h-3.5 w-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            STANDAR ARSIP DIGITAL • ISO 19005 (PDF/A)
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">
            Konversi Dokumen PDF ke <span className="text-indigo-600">Format Standar PDF/A</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Ubah dokumen PDF Anda menjadi format standar ISO PDF/A (PDF/A-1b, PDF/A-2b, PDF/A-3b). Menjamin keabsahan dokumen untuk pendaftaran CPNS, BUMN, peradilan, dan arsip legal jangka panjang bebas risiko file corrupt di masa depan.
          </p>
        </div>

        {/* Notifikasi Pesan Kesalahan */}
        {(loadError || convertError) && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 sm:text-sm shadow-xs">
            <svg className="h-5 w-5 shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 font-medium">{loadError || convertError}</div>
            <button
              onClick={() => {
                setLoadError(null);
                setConvertError(null);
              }}
              className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 1: BELUM ADA FILE (DROPZONE UTAMA) */}
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
                  ? 'border-indigo-500 bg-indigo-50/70 shadow-2xl scale-[1.01]'
                  : 'border-slate-300/80 bg-white/95 shadow-xl shadow-slate-200/50 hover:border-indigo-400 hover:bg-white hover:shadow-2xl hover:scale-[1.005]'
              }`}
            >
              {/* Visual Icon */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/30 transition-transform duration-300 group-hover:scale-110">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md border-2 border-white">
                  <span className="text-[10px] font-black font-mono">ISO</span>
                </div>
              </div>

              {isLoadingPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
                  <p className="text-base font-semibold text-slate-700">
                    Memuat dan menganalisis struktur berkas PDF...
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
                    Unggah berkas dokumen PDF yang ingin dikonversi ke standar arsip legal ISO PDF/A. Anda juga dapat menempel berkas dengan <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 border border-slate-300">Ctrl + V</kbd>.
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
                      <span>Standar Resmi CPNS &amp; BUMN (PDF/A-1b)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span>100% Client-Side Tanpa Upload Server</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span>Pembersihan Skrip &amp; XMP Metadata ISO</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 2: FILE SUDAH DIMUAT (PRATINJAU HALAMAN & OPSI KONVERSI PDF/A) */}
        {/* ========================================================================================= */}
        {inspectData && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Kolom Kiri: Pratinjau Grid Seluruh Halaman Dokumen (lg:col-span-8) */}
            <div className="space-y-4 lg:col-span-8">
              {/* Header Toolbar Pratinjau */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Pratinjau Seluruh Halaman Dokumen
                  </span>
                  <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                    {inspectData.pageCount} Halaman
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Versi Asli: <strong className="text-slate-700">PDF {inspectData.pdfVersion}</strong></span>
                </div>
              </div>

              {/* Grid Thumbnail Seluruh Halaman */}
              <div className="rounded-3xl border border-slate-200/90 bg-slate-100/70 p-4 sm:p-6 shadow-inner max-h-[640px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {inspectData.pages.map((p) => (
                    <div
                      key={p.pageNum}
                      onClick={() => setActivePreviewPage(p.pageNum)}
                      className="group relative flex flex-col items-center rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-sm transition hover:border-indigo-400 hover:shadow-md cursor-pointer"
                    >
                      <div className="relative w-full overflow-hidden rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                        {p.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.thumbnailUrl}
                            alt={`Halaman ${p.pageNum}`}
                            className="w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center text-xs text-slate-300">
                            Halaman {p.pageNum}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-indigo-600/0 transition group-hover:bg-indigo-600/10 flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition rounded-lg bg-slate-900/80 px-2 py-1 text-[10px] font-bold text-white shadow">
                            Perbesar
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex w-full items-center justify-between text-[11px] font-bold text-slate-600 px-1">
                        <span>Hal {p.pageNum}</span>
                        <span className="text-[10px] font-normal text-slate-400 font-mono">
                          {p.width} × {p.height} pt
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel Kesiapan Standar ISO PDF/A */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                  <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Protokol Kepatuhan Arsip ISO yang Diterapkan Otomatis:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-indigo-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Penyematan XMP Metadata resmi ISO 19005</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Penyematan OutputIntent warna GTS_PDFA1</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Pembersihan aksi JavaScript &amp; eksekusi aktif</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Penetapan struktur logis MarkInfo arsip</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Pengaturan Opsi Konversi PDF/A (lg:col-span-4) */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-6 sticky top-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Opsi Format PDF/A
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Pilih tingkat standar ISO sesuai kebutuhan instansi Anda
                  </p>
                </div>

                {/* 1. Pemilihan Tingkat Standar ISO PDF/A */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Pilih Standar ISO PDF/A
                  </label>
                  <div className="space-y-2">
                    {(Object.keys(PDFA_STANDARDS) as PdfaStandard[]).map((key) => {
                      const item = PDFA_STANDARDS[key];
                      const isSelected = standard === key;
                      return (
                        <div
                          key={key}
                          onClick={() => setStandard(key)}
                          className={`cursor-pointer rounded-2xl border p-3.5 transition select-none ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-extrabold">{item.name}</span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-normal leading-relaxed">
                            {item.desc}
                          </p>
                          <div className="mt-2 text-[10px] text-indigo-700 font-medium bg-white/80 rounded-lg p-1.5 border border-indigo-100">
                            <strong>Cocok untuk:</strong> {item.recommendedFor}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Profil Warna Output Intent */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Profil Warna Output Intent
                  </label>
                  <select
                    value={colorProfile}
                    onChange={(e) => setColorProfile(e.target.value as PdfaColorProfile)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold text-slate-800 transition focus:border-indigo-500 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    {(Object.keys(PDFA_COLOR_PROFILES) as PdfaColorProfile[]).map((key) => (
                      <option key={key} value={key}>
                        {PDFA_COLOR_PROFILES[key].name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    {PDFA_COLOR_PROFILES[colorProfile].desc}
                  </p>
                </div>

                {/* 3. Opsi Pembersihan & Kepatuhan ISO */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Kepatuhan &amp; Integritas Arsip
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={removeScripts}
                      onChange={(e) => setRemoveScripts(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <span>Hapus JavaScript &amp; aksi aktif (Wajib ISO)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={removeEncryption}
                      onChange={(e) => setRemoveEncryption(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <span>Hapus enkripsi &amp; pembatasan sandi</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={embedXmpMetadata}
                      onChange={(e) => setEmbedXmpMetadata(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <span>Sematkan XMP Metadata ISO 19005</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={embedOutputIntent}
                      onChange={(e) => setEmbedOutputIntent(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <span>Sematkan OutputIntent GTS_PDFA1</span>
                  </label>
                </div>

                {/* 4. Nama File Output */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nama File PDF/A
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="dokumen-pdfa"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-12 text-xs font-semibold text-slate-800 transition focus:border-indigo-500 focus:bg-white focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-xs font-bold text-indigo-700">
                      .pdf
                    </span>
                  </div>
                </div>

                {/* Progres Konversi */}
                {isConverting && convertStatus && (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                      <span>{convertStatus.message}</span>
                      <span>{Math.round((convertStatus.step / convertStatus.total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-200">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{
                          width: `${(convertStatus.step / convertStatus.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Tombol CTA Utama (Rose Merah Menonjol Khas ScorpioPDF) */}
                <button
                  type="button"
                  onClick={handleStartConversion}
                  disabled={isConverting}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all duration-200 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isConverting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Menyusun Dokumen PDF/A...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Konversi ke PDF/A Sekarang</span>
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
        {/* HASIL KONVERSI SELESAI */}
        {/* ========================================================================================= */}
        {result && resultUrl && (
          <div className="mt-8 rounded-3xl border border-indigo-200 bg-white p-6 sm:p-8 shadow-xl shadow-indigo-500/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase">
                      Kepatuhan ISO Terverifikasi
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
                  <span>Unduh File PDF/A Sekarang</span>
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

            {/* Statistik Hasil Konversi */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Standar ISO</div>
                <div className="text-base sm:text-lg font-black text-indigo-700 mt-1 uppercase">
                  {currentStandardConfig.name}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Jumlah Halaman</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {result.pageCount} Hal
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Ukuran File</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {formatBytes(result.sizeBytes)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Status Validasi</div>
                <div className="text-sm sm:text-base font-black text-emerald-600 mt-1">
                  XMP &amp; GTS_PDFA1 Valid
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Perbesar Halaman */}
        {activePreviewPage !== null && inspectData && (
          <div
            onClick={() => setActivePreviewPage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-3xl bg-white p-4 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Pratinjau Halaman {activePreviewPage} dari {inspectData.pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage(null)}
                  className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              {inspectData.pages[activePreviewPage - 1]?.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inspectData.pages[activePreviewPage - 1].thumbnailUrl}
                  alt={`Halaman ${activePreviewPage}`}
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
