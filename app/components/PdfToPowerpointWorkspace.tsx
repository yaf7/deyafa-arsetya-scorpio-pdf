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
  convertPdfToPowerpoint,
  formatBytes,
  GeneratedPptxResult,
  inspectPdfForPptx,
  ManagedPdfPresentation,
  PDF_TO_PPTX_MODES,
  PdfSlideSummary,
  PdfToPowerpointOptions,
  PdfToPptxMode,
  PptxQuality,
  PPTX_QUALITIES,
  SLIDE_LAYOUT_CONFIG,
  SlideLayoutOption,
  stripPdfExtension,
} from '@/app/lib/pdf-to-powerpoint';
import { Navbar } from './Navbar';

export function PdfToPowerpointWorkspace() {
  const [pdfFile, setPdfFile] = useState<ManagedPdfPresentation | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Opsi Konversi
  const [mode, setMode] = useState<PdfToPptxMode>('editable');
  const [layout, setLayout] = useState<SlideLayoutOption>('16x9');
  const [quality, setQuality] = useState<PptxQuality>('high');
  const [outputName, setOutputName] = useState<string>('');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  // Tampilan Halaman (Thumbnail vs Teks)
  const [viewTab, setViewTab] = useState<'thumbs' | 'text'>('thumbs');

  // Drag & Drop
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Status Konversi
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Hasil PPTX
  const [result, setResult] = useState<GeneratedPptxResult | null>(null);
  const [resultPptxUrl, setResultPptxUrl] = useState<string | null>(null);

  // Lightbox Modal
  const [lightboxSlide, setLightboxSlide] = useState<PdfSlideSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeThumbUrlsRef = useRef<Set<string>>(new Set());
  const activeResultUrlRef = useRef<string | null>(null);

  // Bersihkan object URL saat unmount
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

  // Keyboard Escape untuk Lightbox
  useEffect(() => {
    if (!lightboxSlide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxSlide(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxSlide]);

  const clearResult = useCallback(() => {
    if (activeResultUrlRef.current) {
      URL.revokeObjectURL(activeResultUrlRef.current);
      activeResultUrlRef.current = null;
    }
    setResultPptxUrl(null);
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
        const inspected = await inspectPdfForPptx(file, (_pageNum, summary) => {
          if (summary.thumbnailUrl) {
            activeThumbUrlsRef.current.add(summary.thumbnailUrl);
          }
          setPdfFile((prev) => {
            if (!prev || prev.file !== file) return prev;
            return {
              ...prev,
              slides: prev.slides.map((s) =>
                s.pageNumber === summary.pageNumber ? summary : s
              ),
            };
          });
        });

        setPdfFile(inspected);
        setSelectedPages(Array.from({ length: inspected.pageCount }, (_, i) => i + 1));
        setLayout(inspected.defaultAspect === '4x3' ? '4x3' : '16x9');
        setOutputName(stripPdfExtension(file.name));
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Gagal memproses file PDF. Pastikan file tidak rusak atau terkunci kata sandi.'
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
        f.name.toLowerCase().endsWith('.pdf')
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
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const pdf = Array.from(files).find((f) =>
        f.name.toLowerCase().endsWith('.pdf')
      );
      if (pdf) {
        handleProcessPdfFile(pdf);
      } else {
        setLoadError('Hanya file dokumen berekstensi .pdf yang didukung.');
      }
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessPdfFile(files[0]);
    }
    e.target.value = '';
  };

  const handleResetDocument = () => {
    clearResult();
    setLoadError(null);
    setConversionError(null);
    activeThumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    activeThumbUrlsRef.current.clear();
    setPdfFile(null);
    setSelectedPages([]);
    setOutputName('');
  };

  // Seleksi Slide
  const togglePageSelection = (pageNum: number) => {
    clearResult();
    setSelectedPages((prev) =>
      prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum]
    );
  };

  const handleSelectAll = () => {
    if (!pdfFile) return;
    clearResult();
    setSelectedPages(Array.from({ length: pdfFile.pageCount }, (_, i) => i + 1));
  };

  const handleDeselectAll = () => {
    clearResult();
    setSelectedPages([]);
  };

  const handleSelectOdd = () => {
    if (!pdfFile) return;
    clearResult();
    setSelectedPages(
      Array.from({ length: pdfFile.pageCount }, (_, i) => i + 1).filter(
        (p) => p % 2 === 1
      )
    );
  };

  const handleSelectEven = () => {
    if (!pdfFile) return;
    clearResult();
    setSelectedPages(
      Array.from({ length: pdfFile.pageCount }, (_, i) => i + 1).filter(
        (p) => p % 2 === 0
      )
    );
  };

  // Eksekusi Konversi
  const handleStartConversion = async () => {
    if (!pdfFile) return;
    if (selectedPages.length === 0) {
      setConversionError('Pilih minimal satu halaman untuk dikonversi ke PowerPoint.');
      return;
    }

    setConversionError(null);
    clearResult();
    setIsConverting(true);
    setProgress({ current: 0, total: selectedPages.length, message: 'Menyiapkan slide presentasi...' });

    try {
      const options: PdfToPowerpointOptions = {
        mode,
        layout,
        quality,
        selectedPages: [...selectedPages].sort((a, b) => a - b),
        outputName: outputName || pdfFile.name,
      };

      const generated = await convertPdfToPowerpoint(
        pdfFile.file,
        options,
        (current, total, message) => {
          setProgress({ current, total, message });
        }
      );

      const url = URL.createObjectURL(generated.blob);
      activeResultUrlRef.current = url;
      setResultPptxUrl(url);
      setResult(generated);

      // Otomatis picu download file .pptx
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
          : 'Terjadi kendala saat menyusun presentasi PowerPoint.'
      );
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  };

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
          <span className="text-orange-600 font-bold">PDF ke POWERPOINT</span>
        </div>

        {/* Hero Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-orange-700 shadow-sm backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            PDF KE POWERPOINT (.PPTX) • 100% DIEDIT & PRIVAT
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Konversi <span className="text-orange-600">PDF ke POWERPOINT</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Ubah dokumen PDF Anda kembali menjadi slide presentasi Microsoft PowerPoint (<code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-orange-700 font-semibold">.pptx</code>) yang dapat disunting langsung. Lengkap dengan teks, judul, gambar, dan tata letak asli secara instan di peramban Anda.
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
              className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-300 ${
                isDraggingFile
                  ? 'border-orange-500 bg-orange-50/60 shadow-2xl scale-[1.01]'
                  : 'border-slate-300/80 bg-white/90 shadow-xl shadow-slate-200/50 hover:border-orange-400 hover:bg-white hover:shadow-2xl hover:scale-[1.005]'
              }`}
            >
              {/* Icon Visual */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 transition-transform duration-300 group-hover:scale-110">
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
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md border-2 border-white">
                  <span className="text-[10px] font-extrabold uppercase">PPTX</span>
                </div>
              </div>

              {isLoadingPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-orange-500 border-t-transparent" />
                  <p className="text-base font-semibold text-slate-700">
                    Menganalisis presentasi PDF & mengekstrak halaman...
                  </p>
                  <p className="text-xs text-slate-400">
                    Memindai teks, gambar, dan mendeteksi rasio slide asli
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 group-hover:text-orange-600 transition">
                    Pilih File Dokumen PDF
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 max-w-md">
                    Seret & letakkan file PDF ke sini, klik untuk memilih dari laptop/komputer, atau tekan <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">Ctrl + V</kbd> untuk menempel.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Format .pptx Standar
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Slide & Teks Bisa Diedit
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Rasio 16:9 & 4:3 Otomatis
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
                    className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:bg-orange-700 hover:shadow-xl group-hover:scale-105 cursor-pointer"
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
                    Pilih File PDF Sekarang
                  </button>
                </>
              )}
            </div>

            {/* Fitur Utama */}
            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 font-bold mb-3">
                  P
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Kompatibel Office & Google Slides
                </h4>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  File <code className="text-orange-600 font-mono">.pptx</code> yang dihasilkan siap dibuka di Microsoft PowerPoint, Google Slides, WPS Presentation, dan Keynote tanpa watermark.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 font-bold mb-3">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Kotak Teks Dapat Diedit Bebas
                </h4>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Elemen teks dipetakan ke kotak teks asli PowerPoint sehingga Anda dapat mengganti kata, mengedit font, mengubah warna, dan memindahkan posisi objek.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 font-bold mb-3">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Privat & Tanpa Batas Ukuran
                </h4>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Dijalankan langsung di browser Anda menggunakan WebAssembly. Dokumen sensitif aman tanpa pernah diunggah ke pihak ketiga.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KONDISI 2: File PDF Telah Dimuat */}
        {pdfFile && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Kolom Kiri: Pratinjau Dokumen & Seleksi Halaman (lg:col-span-8) */}
            <div className="space-y-6 lg:col-span-8">
              {/* Dokumen Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 font-bold">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-slate-900" title={pdfFile.name}>
                      {pdfFile.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatBytes(pdfFile.size)}</span>
                      <span>•</span>
                      <span>{pdfFile.pageCount} Halaman Slide</span>
                      <span>•</span>
                      <span className="font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                        Rasio {pdfFile.defaultAspect === '16x9' ? '16:9 Layar Lebar' : '4:3 Standar'} Terdeteksi
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
                    Ganti PDF
                  </button>
                </div>
              </div>

              {/* Toolbar Pilihan & Tab */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm">
                {/* Tab Switcher */}
                <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
                  <button
                    onClick={() => setViewTab('thumbs')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition cursor-pointer ${
                      viewTab === 'thumbs'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Thumbnail Slide ({pdfFile.pageCount})
                  </button>
                  <button
                    onClick={() => setViewTab('text')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition cursor-pointer ${
                      viewTab === 'text'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Pratinjau Teks
                  </button>
                </div>

                {/* Seleksi Cepat */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                  <span className="text-slate-400 mr-1">Pilih:</span>
                  <button
                    onClick={handleSelectAll}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                  >
                    Semua
                  </button>
                  <button
                    onClick={handleSelectOdd}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                  >
                    Ganjil
                  </button>
                  <button
                    onClick={handleSelectEven}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                  >
                    Genap
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                  >
                    Reset
                  </button>

                  <span className="ml-2 inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                    {selectedPages.length} dari {pdfFile.pageCount} dipilih
                  </span>
                </div>
              </div>

              {/* TAMPILAN 1: GRID THUMBNAIL */}
              {viewTab === 'thumbs' && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {pdfFile.slides.map((s) => {
                    const isSelected = selectedPages.includes(s.pageNumber);
                    return (
                      <div
                        key={s.pageNumber}
                        onClick={() => togglePageSelection(s.pageNumber)}
                        className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 bg-white transition-all duration-200 select-none ${
                          isSelected
                            ? 'border-orange-500 shadow-md shadow-orange-500/10 scale-[1.01]'
                            : 'border-slate-200/80 opacity-60 hover:border-slate-300 hover:opacity-90'
                        }`}
                      >
                        {/* Header kartu: Checkbox & Nomor Slide */}
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePageSelection(s.pageNumber)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                            />
                            <span>Slide {s.pageNumber}</span>
                          </div>

                          {/* Tombol Perbesar / Lightbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxSlide(s);
                            }}
                            className="text-slate-400 hover:text-orange-600 transition"
                            title="Perbesar pratinjau slide"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                          </button>
                        </div>

                        {/* Thumbnail Slide (WYSIWYG Sesuai Rasio Slide 16:9 atau 4:3) */}
                        <div
                          style={{
                            aspectRatio:
                              layout === '4x3'
                                ? '4 / 3'
                                : layout === '16x9'
                                ? '16 / 9'
                                : s.isWidescreen
                                ? '16 / 9'
                                : '4 / 3',
                          }}
                          className="relative flex w-full items-center justify-center bg-slate-100 overflow-hidden transition-all duration-200"
                        >
                          {s.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.thumbnailUrl}
                              alt={`Slide ${s.pageNumber}`}
                              className="h-full w-full object-contain p-1 transition duration-200 group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-slate-400">
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-orange-600" />
                              <span className="text-[10px]">Memuat...</span>
                            </div>
                          )}
                        </div>

                        {/* Keterangan Kepadatan Teks Slide & Tag Mode Live */}
                        <div className="border-t border-slate-100 bg-white px-2.5 py-1.5 text-[10px] flex items-center justify-between font-medium gap-1">
                          <span className="text-orange-700 font-bold truncate">
                            {PDF_TO_PPTX_MODES[mode].tag}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold text-orange-800">
                              {layout === '4x3'
                                ? '4:3'
                                : layout === '16x9'
                                ? '16:9'
                                : s.isWidescreen
                                ? '16:9'
                                : '4:3'}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono text-slate-600">
                              {quality === 'ultra' ? '4K' : quality === 'high' ? 'HD' : 'SD'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAMPILAN 2: PRATINJAU TEKS */}
              {viewTab === 'text' && (
                <div className="space-y-4">
                  {pdfFile.slides.map((s) => (
                    <div
                      key={s.pageNumber}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                            Slide {s.pageNumber}
                          </span>
                          <span className="text-xs text-slate-400">
                            {s.charCount} karakter
                          </span>
                        </div>

                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPages.includes(s.pageNumber)}
                            onChange={() => togglePageSelection(s.pageNumber)}
                            className="rounded border-slate-300 text-orange-600"
                          />
                          Sertakan
                        </label>
                      </div>

                      {s.hasText ? (
                        <p className="font-mono text-xs leading-relaxed text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                          {s.snippet || '(Teks terdeteksi namun tidak dapat dipratinjau)'}
                          {s.charCount > 150 && '...'}
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                          <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>Slide ini tidak memiliki teks terpilih (berupa visual penuh, grafik, atau gambar). Mode Rekomendasi akan menyertakan gambar tajam otomatis.</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Kolom Kanan: Pengaturan Konversi & Tombol Aksi (lg:col-span-4) */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-6 sticky top-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Opsi Slide PowerPoint
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesuaikan mode konversi, rasio slide, dan kualitas grafis
                  </p>
                </div>

                {/* 1. Mode Konversi */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Mode Konversi
                  </label>
                  <div className="space-y-2.5">
                    {(Object.keys(PDF_TO_PPTX_MODES) as PdfToPptxMode[]).map((key) => {
                      const item = PDF_TO_PPTX_MODES[key];
                      const isSelected = mode === key;
                      return (
                        <div
                          key={key}
                          onClick={() => setMode(key)}
                          className={`cursor-pointer rounded-2xl border-2 p-3.5 transition-all duration-200 select-none ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50/50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => setMode(key)}
                                className="h-4 w-4 border-slate-300 text-orange-600 focus:ring-orange-500"
                              />
                              <span className="text-xs font-bold text-slate-900">
                                {item.label}
                              </span>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isSelected
                                  ? 'bg-orange-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.tag}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-500 pl-6">
                            {item.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Rasio Slide PowerPoint */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Rasio Dimensi Slide
                  </label>
                  <select
                    value={layout}
                    onChange={(e) => setLayout(e.target.value as SlideLayoutOption)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold text-slate-800 transition focus:border-orange-500 focus:bg-white focus:outline-none"
                  >
                    {(Object.keys(SLIDE_LAYOUT_CONFIG) as SlideLayoutOption[]).map((key) => (
                      <option key={key} value={key}>
                        {SLIDE_LAYOUT_CONFIG[key].label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    {SLIDE_LAYOUT_CONFIG[layout].desc}
                  </p>
                </div>

                {/* 3. Kualitas Visual Slide */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Kualitas Grafis Render
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as PptxQuality)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold text-slate-800 transition focus:border-orange-500 focus:bg-white focus:outline-none"
                  >
                    {(Object.keys(PPTX_QUALITIES) as PptxQuality[]).map((key) => (
                      <option key={key} value={key}>
                        {PPTX_QUALITIES[key].label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    {PPTX_QUALITIES[quality].desc}
                  </p>
                </div>

                {/* 4. Nama File Output */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nama File PowerPoint (.pptx)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="presentasi-powerpoint"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-14 text-xs font-semibold text-slate-800 transition focus:border-orange-500 focus:bg-white focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-xs font-bold text-orange-600">
                      .pptx
                    </span>
                  </div>
                </div>

                {/* Indikator Progres Konversi */}
                {isConverting && progress && (
                  <div className="space-y-2 rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
                    <div className="flex items-center justify-between text-xs font-bold text-orange-800">
                      <span>{progress.message}</span>
                      <span>
                        {Math.round((progress.current / Math.max(1, progress.total)) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-orange-200">
                      <div
                        className="h-full bg-orange-600 transition-all duration-300 rounded-full"
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
                  disabled={isConverting || selectedPages.length === 0}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all duration-200 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isConverting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Mengonversi ke PowerPoint...</span>
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
                          d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                        />
                      </svg>
                      <span>Konversi ke POWERPOINT (.pptx)</span>
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
              {result && resultPptxUrl && (
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
                        File presentasi PowerPoint telah otomatis diunduh.
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
                      <span>{result.slideCount} Slide</span>
                      <span>•</span>
                      <span>Format Microsoft PowerPoint (.pptx)</span>
                    </div>
                  </div>

                  {/* Tombol Unduh Manual Ulang */}
                  <a
                    href={resultPptxUrl}
                    download={result.fileName}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-3 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Unduh Ulang File .pptx
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {lightboxSlide && (
        <div
          onClick={() => setLightboxSlide(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                  Slide {lightboxSlide.pageNumber}
                </span>
                <span className="text-xs text-slate-500">
                  {lightboxSlide.widthPt} × {lightboxSlide.heightPt} pt
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxSlide(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Gambar Besar */}
            <div className="flex-1 overflow-auto bg-slate-100 p-4 text-center">
              {lightboxSlide.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightboxSlide.thumbnailUrl}
                  alt={`Pratinjau Slide ${lightboxSlide.pageNumber}`}
                  className="mx-auto max-h-[75vh] w-auto rounded-lg shadow-lg object-contain bg-white"
                />
              ) : (
                <div className="py-20 text-slate-400 text-sm">
                  Pratinjau visual tidak tersedia.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
