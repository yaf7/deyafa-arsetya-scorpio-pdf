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
  convertRenderedDocxToPdf,
  formatBytes,
  GeneratedWordPdfResult,
  renderDocxToElement,
  stripWordExtension,
  WORD_PAGE_SIZES,
  WORD_RENDER_QUALITIES,
  WordPageSize,
  WordRenderQuality,
} from '@/app/lib/word-to-pdf';
import { Navbar } from './Navbar';

export function WordToPdfWorkspace() {
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [isLoadingWord, setIsLoadingWord] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Opsi Konversi
  const [pageSize, setPageSize] = useState<WordPageSize>('a4');
  const [quality, setQuality] = useState<WordRenderQuality>('high');
  const [outputName, setOutputName] = useState<string>('');
  const [previewZoom, setPreviewZoom] = useState<number>(100);

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
  const [result, setResult] = useState<GeneratedWordPdfResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);
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
    setResultUrl(null);
    setResult(null);
  }, []);

  const handleProcessWordFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.docx') && !lower.endsWith('.doc')) {
        setLoadError(
          'File harus berupa dokumen Microsoft Word yang valid (.docx atau .doc).'
        );
        return;
      }

      setLoadError(null);
      setConversionError(null);
      clearResult();
      setIsLoadingWord(true);
      setWordFile(file);
      setOutputName(stripWordExtension(file.name));

      // Beri sedikit jeda agar kontainer pratinjau siap di DOM
      setTimeout(async () => {
        if (!docxContainerRef.current) return;
        try {
          const { pageCount: pages } = await renderDocxToElement(
            file,
            docxContainerRef.current
          );
          setPageCount(pages);
        } catch (err) {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Gagal memproses dokumen Word. Pastikan format file adalah .docx yang valid.'
          );
          setWordFile(null);
        } finally {
          setIsLoadingWord(false);
        }
      }, 50);
    },
    [clearResult]
  );

  // Dukungan Ctrl + V untuk menempel file Word dari clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      const file = Array.from(e.clipboardData.files).find((f) => {
        const lower = f.name.toLowerCase();
        return lower.endsWith('.docx') || lower.endsWith('.doc');
      });
      if (file) {
        e.preventDefault();
        void handleProcessWordFile(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleProcessWordFile]);

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      void handleProcessWordFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleProcessWordFile(e.dataTransfer.files[0]);
    }
  };

  const handleResetDocument = () => {
    clearResult();
    setLoadError(null);
    setConversionError(null);
    setWordFile(null);
    setPageCount(1);
    setOutputName('');
    if (docxContainerRef.current) {
      docxContainerRef.current.innerHTML = '';
    }
  };

  const handleStartConversion = async () => {
    if (!wordFile || !docxContainerRef.current) return;

    setConversionError(null);
    clearResult();
    setIsConverting(true);
    setProgress({ current: 0, total: pageCount });

    try {
      const generated = await convertRenderedDocxToPdf(
        docxContainerRef.current,
        {
          pageSize,
          quality,
          outputName: outputName || wordFile.name,
        },
        stripWordExtension(wordFile.name),
        (current, total) => {
          setProgress({ current, total });
        }
      );

      const url = URL.createObjectURL(generated.blob);
      activeResultUrlRef.current = url;
      setResultUrl(url);
      setResult(generated);

      // Otomatis unduh PDF saat selesai
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
          : 'Terjadi kesalahan saat mengonversi dokumen Word ke PDF.'
      );
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F1F4F9] text-slate-900">
      <Navbar />

      {/* Input File Tersembunyi */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Pilih dokumen Word"
      />

      <main className="relative flex flex-1 flex-col lg:flex-row">
        {/* AREA UTAMA KANVAS (Dropzone / Pratinjau Word / Hasil Konversi) */}
        <section
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="relative flex flex-1 flex-col px-4 py-6 sm:px-8 lg:min-h-[calc(100vh-72px)]"
        >
          {/* Latar Titik Halus */}
          <div
            className="bg-dot-grid pointer-events-none absolute inset-0 opacity-65"
            aria-hidden="true"
          />

          {/* Overlay Drag File Baru */}
          {isDraggingFile && (
            <div className="pointer-events-none fixed inset-4 z-50 flex items-center justify-center rounded-3xl border-3 border-dashed border-rose-500 bg-rose-50/90 backdrop-blur-xs">
              <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-xl">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                  <svg
                    className="h-7 w-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <p className="font-display text-lg font-bold text-slate-900">
                  Lepaskan Dokumen Word di Sini
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Format .docx akan langsung dimuat dengan pratinjau halaman asli
                </p>
              </div>
            </div>
          )}

          <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col">
            {/* Breadcrumb & Bar Dokumen */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-white hover:text-rose-600"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  <span>Semua Alat</span>
                </Link>
                <span>/</span>
                <span className="font-bold text-slate-800">WORD ke PDF</span>
                {wordFile && (
                  <span className="ml-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-700 shadow-2xs ring-1 ring-slate-200">
                    {pageCount} Halaman Terdeteksi • {formatBytes(wordFile.size)}
                  </span>
                )}
              </div>

              {wordFile && !result && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs text-xs font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(Math.max(60, previewZoom - 15))}
                      className="px-2 py-0.5 hover:text-slate-900 cursor-pointer"
                      title="Perkecil Zoom"
                    >
                      -
                    </button>
                    <span className="px-1 text-[11px] text-slate-500 font-mono">
                      {previewZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(Math.min(150, previewZoom + 15))}
                      className="px-2 py-0.5 hover:text-slate-900 cursor-pointer"
                      title="Perbesar Zoom"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Ganti File
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDocument}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:border-rose-300 hover:text-rose-600"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>

            {/* Pesan Kesalahan */}
            {loadError && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                <span>{loadError}</span>
                <button
                  type="button"
                  onClick={() => setLoadError(null)}
                  className="cursor-pointer font-bold underline"
                >
                  Tutup
                </button>
              </div>
            )}

            {conversionError && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                <span>{conversionError}</span>
                <button
                  type="button"
                  onClick={() => setConversionError(null)}
                  className="cursor-pointer font-bold underline"
                >
                  Tutup
                </button>
              </div>
            )}

            {/* KONDISI 1: HASIL KONVERSI SELESAI */}
            {result && resultUrl ? (
              <div className="my-auto flex flex-col items-center justify-center py-6">
                <div className="w-full max-w-xl rounded-3xl border border-slate-200/90 bg-white p-8 text-center shadow-[0_24px_60px_-15px_rgba(15,23,42,0.12)]">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                    <svg
                      className="h-8 w-8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>

                  <h1 className="font-display text-2xl font-extrabold text-slate-900">
                    File PDF Anda Sudah Siap!
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    Dokumen Word berhasil dikonversi ke PDF dengan tata letak
                    halaman yang rapi.
                  </p>

                  <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-left">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {result.fileName}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {result.pageCount} Halaman PDF • {formatBytes(result.sizeBytes)}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 rounded-lg bg-blue-100 px-2.5 py-1 font-mono text-xs font-bold text-blue-700 uppercase">
                      PDF
                    </span>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <a
                      href={resultUrl}
                      download={result.fileName}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_rgba(225,29,72,0.45)] transition hover:bg-rose-700"
                    >
                      <svg
                        className="h-4.5 w-4.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 4v12m0 0-4-4m4 4 4-4" />
                        <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
                      </svg>
                      <span>Unduh File PDF</span>
                    </a>

                    <a
                      href={resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <span>Lihat Pratinjau PDF</span>
                    </a>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 pt-5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={clearResult}
                      className="cursor-pointer text-slate-600 transition hover:text-rose-600"
                    >
                      ← Kembali Ubah Pengaturan
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleResetDocument}
                      className="cursor-pointer text-slate-500 transition hover:text-slate-900"
                    >
                      Konversi Dokumen Word Lain
                    </button>
                  </div>
                </div>
              </div>
            ) : !wordFile ? (
              /* KONDISI 2: BELUM ADA FILE WORD (DROPZONE UTAMA) */
              <div className="my-auto flex flex-col items-center justify-center py-6 text-center">
                <div className="w-full max-w-2xl rounded-3xl border border-slate-200/90 bg-white/95 p-8 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08)] sm:p-12">
                  <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1 text-[11px] font-bold tracking-wider text-blue-700 uppercase ring-1 ring-blue-200/80">
                    WORD ke PDF • Siap Pakai
                  </div>

                  <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                    Konversi Dokumen WORD ke PDF
                  </h1>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                    Ubah dokumen Microsoft Word (.docx) menjadi file PDF berkualitas
                    tinggi dan siap cetak. Mempertahankan tata letak asli, tabel,
                    dan gambar dokumen secara presisi langsung di browser Anda.
                  </p>

                  <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 transition hover:border-rose-300 hover:bg-rose-50/25">
                    <button
                      type="button"
                      disabled={isLoadingWord}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-rose-600 px-8 py-4 text-base font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.45)] transition hover:-translate-y-0.5 hover:bg-rose-700 disabled:opacity-60"
                    >
                      {isLoadingWord ? (
                        <>
                          <svg
                            className="h-5 w-5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8H4z"
                            />
                          </svg>
                          <span>Memuat Dokumen Word...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                          </svg>
                          <span>Pilih Dokumen Word</span>
                        </>
                      )}
                    </button>

                    <p className="mt-4 text-xs font-medium text-slate-500">
                      atau seret &amp; lepas file Word ke area ini • dukung tempel
                      langsung dengan{' '}
                      <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-600">
                        Ctrl + V
                      </kbd>
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11.5px] font-semibold text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      ✓ Format .DOCX Word Modern
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      ✓ Pratinjau tata letak dokumen langsung
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      ✓ Pilihan ukuran kertas A4, F4, &amp; Letter
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* KONDISI 3: PRATINJAU DOKUMEN WORD DI DOM */
              <div className="relative flex-1 pt-2 pb-10">
                <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">
                    Pratinjau Tata Letak Dokumen Word ({pageCount} Halaman)
                  </span>
                  <span>Skala Pratinjau: {previewZoom}%</span>
                </div>

                <div className="max-h-[calc(100vh-210px)] overflow-auto rounded-3xl border border-slate-200/90 bg-slate-200/70 p-4 sm:p-6 shadow-inner">
                  <div
                    style={{
                      transform: `scale(${previewZoom / 100})`,
                      transformOrigin: 'top center',
                      transition: 'transform 0.15s ease',
                    }}
                    className="flex justify-center"
                  >
                    {/* Wadah docx-preview merender dokumen */}
                    <div
                      ref={docxContainerRef}
                      className="word-docx-preview-container max-w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* PANEL OPSI KANAN */}
        <aside className="relative flex w-full shrink-0 flex-col justify-between border-t border-slate-200 bg-white lg:w-[365px] lg:border-t-0 lg:border-l xl:w-[390px]">
          <div className="space-y-6 p-6">
            <div className="border-b border-slate-100 pb-4 text-center">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-slate-900">
                Opsi WORD ke PDF
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Sesuaikan ukuran kertas dan resolusi dokumen PDF
              </p>
            </div>

            {/* 1. Ukuran Kertas PDF */}
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wide text-slate-700">
                Ukuran Kertas Halaman PDF
              </label>
              <div className="space-y-2">
                {(Object.keys(WORD_PAGE_SIZES) as WordPageSize[]).map((sizeKey) => {
                  const sz = WORD_PAGE_SIZES[sizeKey];
                  const isActive = pageSize === sizeKey;
                  return (
                    <button
                      key={sizeKey}
                      type="button"
                      onClick={() => setPageSize(sizeKey)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-2.5 text-left transition ${
                        isActive
                          ? 'border-slate-800 bg-slate-50 text-slate-900 ring-1 ring-slate-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {sz.label}
                          </span>
                          {sizeKey === 'a4' && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9.5px] font-bold text-blue-700">
                              Standar
                            </span>
                          )}
                          {sizeKey === 'f4' && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-bold text-amber-800">
                              Folio RI
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{sz.desc}</p>
                      </div>
                      <span
                        className={`h-4 w-4 rounded-full border flex items-center justify-center text-[10px] ${
                          isActive
                            ? 'border-rose-600 bg-rose-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {isActive && '•'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Kualitas Render PDF */}
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wide text-slate-700">
                Kualitas Render Tipografi &amp; Gambar
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(WORD_RENDER_QUALITIES) as WordRenderQuality[]).map(
                  (qKey) => {
                    const q = WORD_RENDER_QUALITIES[qKey];
                    const isActive = quality === qKey;
                    return (
                      <button
                        key={qKey}
                        type="button"
                        onClick={() => setQuality(qKey)}
                        className={`cursor-pointer rounded-xl border py-2.5 text-center text-xs font-semibold transition ${
                          isActive
                            ? 'border-slate-800 bg-slate-50 text-slate-900 ring-1 ring-slate-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="block font-bold">
                          {q.label.split(' ')[0]}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {qKey === 'high' ? '2x' : qKey === 'ultra' ? '2.6x' : '1.5x'}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* 3. Nama File Hasil */}
            <div>
              <label
                htmlFor="wordOutputNameInput"
                className="mb-1.5 block text-xs font-bold tracking-wide text-slate-700"
              >
                Nama file PDF hasil
              </label>
              <div className="relative">
                <input
                  id="wordOutputNameInput"
                  type="text"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  placeholder="ScorpioPDF-Dokumen"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 transition focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 focus:outline-none"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[11px] text-slate-400">
                  .pdf
                </span>
              </div>
            </div>

            {/* 4. Ringkasan Pilihan */}
            {wordFile && (
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3.5 text-xs text-slate-600">
                <div className="flex justify-between font-semibold">
                  <span>Halaman Dokumen:</span>
                  <span className="font-bold text-slate-900">
                    {pageCount} Halaman
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Target Ukuran:</span>
                  <span className="font-medium text-slate-700">
                    {WORD_PAGE_SIZES[pageSize].label.split(' ')[0]}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Detail Render:</span>
                  <span className="font-medium text-slate-700">
                    {WORD_RENDER_QUALITIES[quality].label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Area Tombol CTA Konversi */}
          <div className="border-t border-slate-200 bg-white p-6">
            {/* Progress Bar saat sedang konversi */}
            {isConverting && progress && (
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>
                    Merender Halaman {progress.current} dari {progress.total}...
                  </span>
                  <span>
                    {Math.round((progress.current / progress.total) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-rose-600 transition-all duration-150"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!wordFile || isConverting || isLoadingWord}
              onClick={handleStartConversion}
              className="group flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-rose-600 px-6 py-4 text-base font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {isConverting ? (
                <>
                  <svg
                    className="h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span>Mengonversi ke PDF...</span>
                </>
              ) : (
                <>
                  <span>Konversi ke PDF ({pageCount} Hal)</span>
                  <svg
                    className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}

