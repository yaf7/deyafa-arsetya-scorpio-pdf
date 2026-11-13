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
  convertPdfToImages,
  DpiOption,
  DPI_CONFIG,
  ExportImageFormat,
  formatBytes,
  GeneratedImageResult,
  inspectPdfDocument,
  ManagedPdfFile,
  PdfPageSummary,
  QUALITY_PRESETS,
  QualityPreset,
  stripPdfExtension,
} from '@/app/lib/pdf-to-jpg';
import { Navbar } from './Navbar';

export function PdfToJpgWorkspace() {
  const [pdfFile, setPdfFile] = useState<ManagedPdfFile | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Opsi Konversi
  const [format, setFormat] = useState<ExportImageFormat>('jpg');
  const [dpi, setDpi] = useState<DpiOption>('150');
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>('0.9');
  const [transparentPng, setTransparentPng] = useState<boolean>(false);
  const [outputName, setOutputName] = useState<string>('');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  // Status Drag & Drop
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Status Konversi
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    pageNumber: number;
  } | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Hasil Konversi
  const [result, setResult] = useState<GeneratedImageResult | null>(null);
  const [resultZipUrl, setResultZipUrl] = useState<string | null>(null);

  // Lightbox Modal
  const [lightboxPage, setLightboxPage] = useState<PdfPageSummary | null>(null);

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
    setResultZipUrl(null);
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
        const inspected = await inspectPdfDocument(
          file,
          (_pageNum, thumbUrl) => {
            activeThumbUrlsRef.current.add(thumbUrl);
            setPdfFile((prev) => {
              if (!prev || prev.file !== file) return prev;
              return {
                ...prev,
                pages: prev.pages.map((p) =>
                  p.pageNumber === _pageNum ? { ...p, thumbnailUrl: thumbUrl } : p
                ),
              };
            });
          }
        );

        setPdfFile(inspected);
        setSelectedPages(Array.from({ length: inspected.pageCount }, (_, i) => i + 1));
        setOutputName(stripPdfExtension(file.name));
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? `Gagal membaca file PDF: ${err.message}`
            : 'Dokumen PDF rusak atau dilindungi kata sandi.'
        );
      } finally {
        setIsLoadingPdf(false);
      }
    },
    [clearResult]
  );

  // Dukungan Ctrl+V untuk menempel file PDF dari clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      const file = Array.from(e.clipboardData.files).find(
        (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
      );
      if (file) {
        e.preventDefault();
        void handleProcessPdfFile(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleProcessPdfFile]);

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      void handleProcessPdfFile(e.target.files[0]);
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
      void handleProcessPdfFile(e.dataTransfer.files[0]);
    }
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

  // Logika Pemilihan Halaman
  const togglePageSelection = (pageNum: number) => {
    clearResult();
    setSelectedPages((prev) =>
      prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum]
    );
  };

  const handleSelectAllPages = () => {
    if (!pdfFile) return;
    clearResult();
    setSelectedPages(Array.from({ length: pdfFile.pageCount }, (_, i) => i + 1));
  };

  const handleDeselectAllPages = () => {
    clearResult();
    setSelectedPages([]);
  };

  const handleSelectOddPages = () => {
    if (!pdfFile) return;
    clearResult();
    setSelectedPages(
      Array.from({ length: pdfFile.pageCount }, (_, i) => i + 1).filter(
        (p) => p % 2 === 1
      )
    );
  };

  const handleSelectEvenPages = () => {
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
      setConversionError('Pilih minimal satu halaman untuk dikonversi.');
      return;
    }

    setConversionError(null);
    clearResult();
    setIsConverting(true);
    setProgress({ current: 0, total: selectedPages.length, pageNumber: selectedPages[0] });

    try {
      const generated = await convertPdfToImages(
        pdfFile.file,
        {
          format,
          dpi,
          quality: QUALITY_PRESETS[qualityPreset].value,
          transparentPng,
          selectedPages: [...selectedPages].sort((a, b) => a - b),
          outputName: outputName || pdfFile.name,
        },
        (current, total, pageNumber) => {
          setProgress({ current, total, pageNumber });
        }
      );

      const url = URL.createObjectURL(generated.blob);
      activeResultUrlRef.current = url;
      setResultZipUrl(url);
      setResult(generated);

      // Otomatis download file saat selesai jika single image atau zip
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
          : 'Terjadi kesalahan saat mengonversi halaman PDF menjadi gambar.'
      );
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  };

  const triggerBlobDownload = (blob: Blob, name: string) => {
    const tempUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = tempUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(tempUrl), 1000);
  };

  const handleDownloadAllSeparate = async () => {
    if (!result || result.images.length === 0) return;
    for (let i = 0; i < result.images.length; i++) {
      const img = result.images[i];
      triggerBlobDownload(img.blob, img.fileName);
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F1F4F9] text-slate-900">
      <Navbar />

      {/* Input File Tersembunyi */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Pilih dokumen PDF"
      />

      <main className="relative flex flex-1 flex-col lg:flex-row">
        {/* AREA UTAMA (Dropzone / Grid Halaman / Hasil Konversi) */}
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
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <svg
                    className="h-7 w-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 16V4m0 0-4 4m4-4 4 4" />
                    <path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
                  </svg>
                </div>
                <p className="font-display text-lg font-bold text-slate-900">
                  Lepaskan File PDF di Sini
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Dokumen akan dimuat dan setiap halaman siap dikonversi ke gambar
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
                <span className="font-bold text-slate-800">
                  PDF ke JPG/JPEG/PNG
                </span>
                {pdfFile && (
                  <span className="ml-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-700 shadow-2xs ring-1 ring-slate-200">
                    {pdfFile.pageCount} Halaman • {formatBytes(pdfFile.size)}
                  </span>
                )}
              </div>

              {pdfFile && !result && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Ganti PDF
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
            {result && resultZipUrl ? (
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
                    Gambar Anda Sudah Siap!
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    {result.totalCount} halaman PDF berhasil dikonversi ke gambar{' '}
                    <strong className="font-semibold text-slate-700 uppercase">
                      {result.format}
                    </strong>{' '}
                    dengan resolusi tinggi.
                  </p>

                  <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-left">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {result.fileName}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {result.totalCount} Gambar • {formatBytes(result.blob.size)}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 rounded-lg bg-amber-100 px-2.5 py-1 font-mono text-xs font-bold text-amber-800 uppercase">
                      {result.kind === 'zip' ? 'ZIP' : result.format}
                    </span>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <a
                      href={resultZipUrl}
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
                      <span>
                        Unduh {result.kind === 'zip' ? 'Arsip ZIP' : 'Gambar'}
                      </span>
                    </a>

                    {result.images[0]?.previewUrl && (
                      <a
                        href={result.images[0].previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        <span>Lihat Gambar 1</span>
                      </a>
                    )}
                  </div>

                  {/* Daftar Unduh Gambar Satuan */}
                  {result.images.length > 1 && (
                    <div className="mt-6 border-t border-slate-100 pt-5 text-left">
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                          Unduh Gambar Satuan ({result.images.length})
                        </p>
                        <button
                          type="button"
                          onClick={handleDownloadAllSeparate}
                          className="cursor-pointer text-xs font-bold text-rose-600 hover:underline"
                        >
                          Unduh Semua Satuan Sekaligus ↓
                        </button>
                      </div>
                      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                        {result.images.map((img) => (
                          <div
                            key={img.fileName}
                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="truncate block font-semibold text-slate-700">
                                {img.fileName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {img.widthPx} × {img.heightPx} px •{' '}
                                {formatBytes(img.sizeBytes)}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <a
                                href={img.previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-slate-500 hover:text-slate-800"
                              >
                                Lihat
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  triggerBlobDownload(img.blob, img.fileName)
                                }
                                className="cursor-pointer font-bold text-rose-600 hover:underline"
                              >
                                Unduh
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                      Konversi Dokumen PDF Lain
                    </button>
                  </div>
                </div>
              </div>
            ) : !pdfFile ? (
              /* KONDISI 2: BELUM ADA PDF (DROPZONE UTAMA) */
              <div className="my-auto flex flex-col items-center justify-center py-6 text-center">
                <div className="w-full max-w-2xl rounded-3xl border border-slate-200/90 bg-white/95 p-8 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08)] sm:p-12">
                  <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1 text-[11px] font-bold tracking-wider text-amber-800 uppercase ring-1 ring-amber-200/80">
                    PDF ke JPG/JPEG/PNG • Siap Pakai
                  </div>

                  <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                    Konversi PDF ke JPG/JPEG/PNG
                  </h1>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                    Ekstrak dan ubah setiap halaman dokumen PDF Anda menjadi
                    gambar tajam resolusi tinggi. Pilih format JPG, JPEG, atau
                    PNG dengan pilihan resolusi layar hingga 300 DPI kualitas cetak.
                  </p>

                  <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 transition hover:border-rose-300 hover:bg-rose-50/25">
                    <button
                      type="button"
                      disabled={isLoadingPdf}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-rose-600 px-8 py-4 text-base font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.45)] transition hover:-translate-y-0.5 hover:bg-rose-700 disabled:opacity-60"
                    >
                      {isLoadingPdf ? (
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
                          <span>Memuat Dokumen PDF...</span>
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
                          <span>Pilih File PDF</span>
                        </>
                      )}
                    </button>

                    <p className="mt-4 text-xs font-medium text-slate-500">
                      atau seret &amp; lepas file PDF ke area ini • dukung tempel
                      langsung dengan{' '}
                      <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-600">
                        Ctrl + V
                      </kbd>
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11.5px] font-semibold text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      ✓ Pilihan format JPG, JPEG, &amp; PNG
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      ✓ Resolusi 72 hingga 300 DPI Ultra HD
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      ✓ 100% aman &amp; diproses langsung di browser
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* KONDISI 3: GRID PRATINJAU HALAMAN DOKUMEN PDF */
              <div className="relative flex-1 pt-2 pb-10">
                {/* Toolbar Kontrol Pilihan Halaman */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-800">
                      Pilihan Halaman:
                    </span>
                    <span className="rounded-full bg-rose-50 px-2.5 py-0.5 font-bold text-rose-700">
                      {selectedPages.length} dari {pdfFile.pageCount} halaman dipilih
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={handleSelectAllPages}
                      className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllPages}
                      className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                    >
                      Batal Pilih
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleSelectOddPages}
                      className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                    >
                      Ganjil Saja
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectEvenPages}
                      className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                    >
                      Genap Saja
                    </button>
                  </div>
                </div>

                {/* Grid Kartu Halaman */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                  {pdfFile.pages.map((p) => {
                    const isSelected = selectedPages.includes(p.pageNumber);
                    return (
                      <div
                        key={p.pageNumber}
                        onClick={() => togglePageSelection(p.pageNumber)}
                        className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white p-3 shadow-2xs transition-all ${
                          isSelected
                            ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-md'
                            : 'border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-300'
                        }`}
                      >
                        {/* Header Kartu: Checkbox & Nomor Halaman */}
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md border text-[11px] font-bold transition-colors ${
                              isSelected
                                ? 'border-rose-600 bg-rose-600 text-white'
                                : 'border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="text-[11px] font-bold text-slate-600">
                            Hal {p.pageNumber}
                          </span>
                        </div>

                        {/* Area Thumbnail (WYSIWYG Sesuai Format & Transparansi) */}
                        <div
                          className={`relative flex aspect-[1/1.4] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 ${
                            format === 'png' && transparentPng
                              ? 'bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]'
                              : 'bg-slate-50'
                          }`}
                        >
                          {p.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.thumbnailUrl}
                              alt={`Halaman ${p.pageNumber}`}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                              <svg
                                className="h-6 w-6 animate-pulse"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <rect
                                  x="3"
                                  y="3"
                                  width="18"
                                  height="18"
                                  rx="2"
                                />
                              </svg>
                              <span className="text-[10px] font-medium">
                                Memuat...
                              </span>
                            </div>
                          )}

                          {/* Tombol Pratinjau Lightbox */}
                          {p.thumbnailUrl && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxPage(p);
                              }}
                              title="Perbesar Pratinjau"
                              className="absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 backdrop-blur-xs transition group-hover:opacity-100 hover:bg-black"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                              >
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                                <path d="M11 8v6M8 11h6" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Footer Kartu: Format & Resolusi Pixel Output Live */}
                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 font-bold uppercase text-rose-700">
                            {format}
                          </span>
                          <span className="font-mono text-slate-500">
                            {Math.round(p.widthPt * DPI_CONFIG[dpi].scale)} ×{' '}
                            {Math.round(p.heightPt * DPI_CONFIG[dpi].scale)} px
                          </span>
                        </div>
                      </div>
                    );
                  })}
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
                Opsi PDF ke Gambar
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Pilih format gambar, resolusi DPI, dan kualitas output
              </p>
            </div>

            {/* 1. Format Gambar */}
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wide text-slate-700">
                Format Gambar Output
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['jpg', 'jpeg', 'png'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`cursor-pointer rounded-xl border py-2.5 text-center text-xs font-bold uppercase transition ${
                      format === fmt
                        ? 'border-slate-800 bg-slate-50 text-slate-900 ring-1 ring-slate-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    .{fmt}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {format === 'png'
                  ? 'Format PNG tanpa kompresi kehilangan (lossless), tajam untuk teks grafis.'
                  : 'Format JPG standar kompresi foto, ukuran file seimbang dan kompatibel di semua perangkat.'}
              </p>
            </div>

            {/* 2. Resolusi & Ketajaman (DPI) */}
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wide text-slate-700">
                Resolusi Render (DPI)
              </label>
              <div className="space-y-2">
                {(Object.keys(DPI_CONFIG) as DpiOption[]).map((dpiKey) => {
                  const cfg = DPI_CONFIG[dpiKey];
                  const isActive = dpi === dpiKey;
                  return (
                    <button
                      key={dpiKey}
                      type="button"
                      onClick={() => setDpi(dpiKey)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-2.5 text-left transition ${
                        isActive
                          ? 'border-slate-800 bg-slate-50 text-slate-900 ring-1 ring-slate-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {cfg.label}
                          </span>
                          {dpiKey === '150' && (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9.5px] font-bold text-rose-700">
                              Rekomendasi
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{cfg.desc}</p>
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

            {/* 3. Kualitas Kompresi (Hanya untuk JPG/JPEG) */}
            {format !== 'png' && (
              <div>
                <label className="mb-2 block text-xs font-bold tracking-wide text-slate-700">
                  Kualitas Kompresi JPG
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(QUALITY_PRESETS) as QualityPreset[]).map((qKey) => {
                    const preset = QUALITY_PRESETS[qKey];
                    const isActive = qualityPreset === qKey;
                    return (
                      <button
                        key={qKey}
                        type="button"
                        onClick={() => setQualityPreset(qKey)}
                        className={`cursor-pointer rounded-xl border py-2 text-center text-xs font-semibold transition ${
                          isActive
                            ? 'border-slate-800 bg-slate-50 text-slate-900 ring-1 ring-slate-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {preset.label.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Transparansi (Hanya untuk PNG) */}
            {format === 'png' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <label className="flex cursor-pointer items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Latar Belakang Transparan</span>
                  <input
                    type="checkbox"
                    checked={transparentPng}
                    onChange={(e) => setTransparentPng(e.target.checked)}
                    className="h-4 w-4 accent-rose-600 cursor-pointer rounded"
                  />
                </label>
                <p className="mt-1 text-[11px] text-slate-500">
                  Jika tidak dicentang, latar belakang halaman otomatis diisi
                  warna putih bersih seperti kertas cetak.
                </p>
              </div>
            )}

            {/* 5. Nama File Hasil */}
            <div>
              <label
                htmlFor="outputNameInput"
                className="mb-1.5 block text-xs font-bold tracking-wide text-slate-700"
              >
                Nama file output
              </label>
              <div className="relative">
                <input
                  id="outputNameInput"
                  type="text"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  placeholder="ScorpioPDF-Dokumen"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 transition focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 focus:outline-none"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[11px] text-slate-400">
                  {selectedPages.length > 1 ? '.zip' : `.${format}`}
                </span>
              </div>
            </div>

            {/* 6. Ringkasan Pilihan */}
            {pdfFile && (
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3.5 text-xs text-slate-600">
                <div className="flex justify-between font-semibold">
                  <span>Total Halaman Dipilih:</span>
                  <span className="font-bold text-slate-900">
                    {selectedPages.length} Halaman
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Format &amp; Resolusi:</span>
                  <span className="font-medium text-slate-700">
                    {format.toUpperCase()} • {DPI_CONFIG[dpi].label}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Metode Kemasan:</span>
                  <span className="font-medium text-slate-700">
                    {selectedPages.length > 1
                      ? 'Arsip ZIP (berisi seluruh gambar)'
                      : `File tunggal .${format}`}
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
                  <span>Merender Halaman {progress.pageNumber}...</span>
                  <span>
                    {Math.round((progress.current / progress.total) * 100)}% (
                    {progress.current}/{progress.total})
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
              disabled={
                !pdfFile ||
                selectedPages.length === 0 ||
                isConverting ||
                isLoadingPdf
              }
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
                  <span>Mengonversi ke Gambar...</span>
                </>
              ) : (
                <>
                  <span>
                    Konversi ke {format.toUpperCase()} (
                    {selectedPages.length} Hal)
                  </span>
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

      {/* LIGHTBOX MODAL */}
      {lightboxPage && (
        <div
          onClick={() => setLightboxPage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] max-w-4xl flex-col items-center overflow-hidden rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex w-full items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Pratinjau Halaman {lightboxPage.pageNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Ukuran dokumen asli: {lightboxPage.widthPt} ×{' '}
                  {lightboxPage.heightPt} pt
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

            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-xl bg-slate-50 p-2">
              {lightboxPage.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightboxPage.thumbnailUrl}
                  alt={`Halaman ${lightboxPage.pageNumber}`}
                  className="max-h-[65vh] w-auto rounded-lg shadow-md object-contain"
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
