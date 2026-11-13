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
  convertImagesToPdf,
  detectImageFormatLabel,
  formatBytes,
  GeneratedPdfResult,
  ImageFitMode,
  isSupportedImageFile,
  MarginOption,
  PAGE_DIMENSIONS_PT,
  PageOrientation,
  PageSizeOption,
  QualityOption,
  readImageDimensions,
} from '@/app/lib/jpg-to-pdf';
import { Navbar } from './Navbar';

interface ManagedImage {
  id: string;
  file: File;
  name: string;
  format: 'JPG' | 'PNG';
  size: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  previewUrl: string;
}

export function JpgToPdfWorkspace() {
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
  const [margin, setMargin] = useState<MarginOption>('none');
  const [fitMode, setFitMode] = useState<ImageFitMode>('contain');
  const [quality, setQuality] = useState<QualityOption>('balanced');
  const [mergeAll, setMergeAll] = useState<boolean>(true);
  const [outputName, setOutputName] = useState<string>('ScorpioPDF-Gambar');

  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [isDraggingFiles, setIsDraggingFiles] = useState<boolean>(false);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<GeneratedPdfResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<ManagedImage | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePreviewUrlsRef = useRef<Set<string>>(new Set());
  const activeResultUrlRef = useRef<string | null>(null);
  const dragDepthRef = useRef<number>(0);

  // Bersihkan seluruh Object URL saat komponen dilepas
  useEffect(() => {
    const previewUrls = activePreviewUrlsRef.current;
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
      if (activeResultUrlRef.current) {
        URL.revokeObjectURL(activeResultUrlRef.current);
        activeResultUrlRef.current = null;
      }
    };
  }, []);

  // Tutup lightbox dengan Escape
  useEffect(() => {
    if (!lightboxItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxItem]);

  const totalBytes = useMemo(
    () => images.reduce((sum, img) => sum + img.size, 0),
    [images]
  );

  const clearResult = useCallback(() => {
    if (activeResultUrlRef.current) {
      URL.revokeObjectURL(activeResultUrlRef.current);
      activeResultUrlRef.current = null;
    }
    setResultUrl(null);
    setResult(null);
  }, []);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;

      setErrorMessage(null);
      setWarningMessage(null);
      clearResult();

      const validFiles: File[] = [];
      const skippedNames: string[] = [];

      for (const file of incoming) {
        if (isSupportedImageFile(file)) {
          validFiles.push(file);
        } else {
          skippedNames.push(file.name);
        }
      }

      if (skippedNames.length > 0) {
        setWarningMessage(
          `${skippedNames.length} file dilewati karena bukan format JPG, JPEG, atau PNG (${skippedNames
            .slice(0, 3)
            .join(', ')}${skippedNames.length > 3 ? ', ...' : ''}).`
        );
      }

      if (validFiles.length === 0) return;

      const prepared: ManagedImage[] = [];

      for (const file of validFiles) {
        let dims = { width: 1000, height: 1400 };
        try {
          dims = await readImageDimensions(file);
        } catch {
          // Gunakan dimensi fallback bila browser gagal membaca ukuran awal
        }
        const url = URL.createObjectURL(file);
        activePreviewUrlsRef.current.add(url);

        prepared.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          name: file.name,
          format: detectImageFormatLabel(file),
          size: file.size,
          width: dims.width,
          height: dims.height,
          rotation: 0,
          previewUrl: url,
        });
      }

      setImages((prev) => [...prev, ...prepared]);
    },
    [clearResult]
  );

  // Dukungan Ctrl+V untuk menempel gambar langsung dari clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      const files = Array.from(e.clipboardData.files);
      const hasImage = files.some((f) => isSupportedImageFile(f));
      if (hasImage) {
        e.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles]);

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleCanvasDragEnter = (e: DragEvent<HTMLDivElement>) => {
    // Abaikan jika sedang drag kartu untuk mengurutkan
    if (draggedCardId) return;
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleCanvasDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (draggedCardId) return;
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
  };

  const handleCanvasDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (draggedCardId) return;
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false);
    }
  };

  const handleCanvasDrop = (e: DragEvent<HTMLDivElement>) => {
    if (draggedCardId) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void addFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (id: string) => {
    clearResult();
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        activePreviewUrlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleClearAll = () => {
    clearResult();
    setWarningMessage(null);
    setErrorMessage(null);
    setImages((prev) => {
      prev.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
        activePreviewUrlsRef.current.delete(item.previewUrl);
      });
      return [];
    });
  };

  const handleRotateImage = (id: string) => {
    clearResult();
    setImages((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              rotation: (((item.rotation + 90) % 360) as 0 | 90 | 180 | 270),
            }
          : item
      )
    );
  };

  const handleMoveImage = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    clearResult();
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleSortToggle = () => {
    clearResult();
    const nextAsc = !sortAsc;
    setSortAsc(nextAsc);
    setImages((prev) =>
      [...prev].sort((a, b) =>
        nextAsc
          ? a.name.localeCompare(b.name, 'id', { numeric: true })
          : b.name.localeCompare(a.name, 'id', { numeric: true })
      )
    );
  };

  const handleCardDrop = (targetId: string) => {
    if (!draggedCardId || draggedCardId === targetId) {
      setDraggedCardId(null);
      setDragOverCardId(null);
      return;
    }
    clearResult();
    setImages((prev) => {
      const fromIndex = prev.findIndex((i) => i.id === draggedCardId);
      const toIndex = prev.findIndex((i) => i.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const handleConvert = async () => {
    if (images.length === 0 || isConverting) return;

    setIsConverting(true);
    setErrorMessage(null);
    setProgress({ current: 1, total: images.length, fileName: images[0].name });
    clearResult();

    try {
      const output = await convertImagesToPdf(
        images.map((item) => ({
          id: item.id,
          file: item.file,
          name: item.name,
          width: item.width,
          height: item.height,
          rotation: item.rotation,
        })),
        {
          orientation,
          pageSize,
          margin,
          fitMode,
          quality,
          mergeAll,
          outputName,
        },
        (current, total, fileName) => {
          setProgress({ current, total, fileName });
        }
      );

      const url = URL.createObjectURL(output.blob);
      activeResultUrlRef.current = url;
      setResultUrl(url);
      setResult(output);

      // Unduh otomatis saat konversi selesai
      const link = document.createElement('a');
      link.href = url;
      link.download = output.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Terjadi kendala saat mengonversi gambar ke PDF.'
      );
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  };

  // Hitung rasio pratinjau kertas untuk tiap kartu agar WYSIWYG akurat
  const getPageBoxStyle = (item: ManagedImage) => {
    const effW =
      item.rotation === 90 || item.rotation === 270 ? item.height : item.width;
    const effH =
      item.rotation === 90 || item.rotation === 270 ? item.width : item.height;

    let ratio = 210 / 297;
    if (pageSize === 'fit') {
      ratio = Math.max(0.45, Math.min(2.1, effW / Math.max(1, effH)));
    } else {
      const base = PAGE_DIMENSIONS_PT[pageSize];
      const isLandscape =
        orientation === 'landscape' ||
        (orientation === 'auto' && effW > effH);
      ratio = isLandscape
        ? base.height / base.width
        : base.width / base.height;
    }

    const paddingClass =
      margin === 'none' ? 'p-0' : margin === 'small' ? 'p-2.5' : 'p-5';

    return { ratio, paddingClass };
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F1F4F9] text-slate-900">
      <Navbar />

      {/* Input file tersembunyi (tanpa batas jumlah file, JPG, JPEG, & PNG) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Pilih file gambar JPG, JPEG, atau PNG"
      />

      <main className="relative flex flex-1 flex-col lg:flex-row">
        {/* AREA KANVAS KIRI (Dropzone / Grid Pratinjau / Hasil Konversi) */}
        <section
          onDragEnter={handleCanvasDragEnter}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
          className="relative flex flex-1 flex-col px-4 py-6 sm:px-8 lg:min-h-[calc(100vh-72px)]"
        >
          {/* Latar titik halus */}
          <div
            className="bg-dot-grid pointer-events-none absolute inset-0 opacity-65"
            aria-hidden="true"
          />

          {/* Overlay saat drag file baru dari komputer */}
          {isDraggingFiles && (
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
                  Lepaskan Gambar JPG/JPEG/PNG di Sini
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Semua gambar akan langsung ditambahkan ke antrean tanpa batas
                  jumlah
                </p>
              </div>
            </div>
          )}

          <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col">
            {/* Breadcrumb & Info Bar */}
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
                  JPG/JPEG/PNG ke PDF
                </span>
                {images.length > 0 && (
                  <span className="ml-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-700 shadow-2xs ring-1 ring-slate-200">
                    {images.length} Gambar • {formatBytes(totalBytes)}
                  </span>
                )}
              </div>

              {images.length > 0 && !result && (
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs font-medium text-slate-500 sm:inline">
                    Seret kartu atau pakai panah untuk ubah urutan
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:border-rose-300 hover:text-rose-600"
                  >
                    Hapus Semua
                  </button>
                </div>
              )}
            </div>

            {/* Pesan Peringatan / Error */}
            {warningMessage && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                <span>{warningMessage}</span>
                <button
                  type="button"
                  onClick={() => setWarningMessage(null)}
                  className="cursor-pointer font-bold text-amber-700 hover:underline"
                >
                  Tutup
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
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
                    {result.kind === 'pdf'
                      ? 'File PDF Anda Sudah Siap!'
                      : 'Arsip ZIP PDF Anda Sudah Siap!'}
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    {result.pageCount} gambar berhasil dikonversi dengan aman di
                    perangkat Anda.
                  </p>

                  <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-left">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {result.fileName}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {result.pageCount}{' '}
                        {result.kind === 'pdf' ? 'Halaman PDF' : 'File PDF'} •{' '}
                        {formatBytes(result.blob.size)}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 rounded-lg bg-rose-100 px-2.5 py-1 font-mono text-xs font-bold text-rose-700 uppercase">
                      {result.kind}
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
                      <span>
                        Unduh {result.kind === 'pdf' ? 'PDF' : 'ZIP'}
                      </span>
                    </a>

                    {result.kind === 'pdf' && (
                      <a
                        href={resultUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        <span>Lihat Pratinjau</span>
                      </a>
                    )}
                  </div>

                  {/* Daftar unduh satuan bila tidak digabung */}
                  {result.individualFiles &&
                    result.individualFiles.length > 1 && (
                      <div className="mt-6 border-t border-slate-100 pt-5 text-left">
                        <p className="mb-2.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
                          Unduh File PDF Satuan ({result.individualFiles.length})
                        </p>
                        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                          {result.individualFiles.map((f, idx) => (
                            <div
                              key={`${f.name}-${idx}`}
                              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs"
                            >
                              <span className="truncate font-semibold text-slate-700">
                                {f.name}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  triggerBlobDownload(f.blob, f.name)
                                }
                                className="ml-3 shrink-0 cursor-pointer font-bold text-rose-600 hover:underline"
                              >
                                Unduh
                              </button>
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
                      ← Kembali Edit / Tambah Gambar
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="cursor-pointer text-slate-500 transition hover:text-slate-900"
                    >
                      Buat PDF Baru dari Awal
                    </button>
                  </div>
                </div>
              </div>
            ) : images.length === 0 ? (
              /* KONDISI 2: BELUM ADA GAMBAR (DROPZONE UTAMA) */
              <div className="my-auto flex flex-col items-center justify-center py-6 text-center">
                <div className="w-full max-w-2xl rounded-3xl border border-slate-200/90 bg-white/95 p-8 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08)] sm:p-12">
                  <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1 text-[11px] font-bold tracking-wider text-amber-800 uppercase ring-1 ring-amber-200/80">
                    JPG/JPEG/PNG ke PDF • Tanpa Batas Jumlah
                  </div>

                  <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                    Konversi JPG/JPEG/PNG ke PDF
                  </h1>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                    Masukkan gambar JPG, JPEG, atau PNG sebanyak apa pun tanpa
                    batas minimal maupun maksimal. Atur urutan, orientasi,
                    ukuran kertas, serta margin dengan pratinjau langsung.
                  </p>

                  <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 transition hover:border-rose-300 hover:bg-rose-50/25">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-rose-600 px-8 py-4 text-base font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.45)] transition hover:-translate-y-0.5 hover:bg-rose-700"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" />
                      </svg>
                      <span>Pilih Gambar JPG/JPEG/PNG</span>
                    </button>

                    <p className="mt-4 text-xs font-medium text-slate-500">
                      atau seret &amp; lepas file ke area ini • dukung tempel
                      langsung dengan{' '}
                      <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-600">
                        Ctrl + V
                      </kbd>
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11.5px] font-semibold text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      ✓ 1 hingga ratusan gambar sekaligus
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      ✓ Format JPG, JPEG, &amp; PNG
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      ✓ Proses aman langsung di browser
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* KONDISI 3: AREA PRATINJAU KARTU GAMBAR (SESUAI REFERENSI GAMBAR) */
              <div className="relative flex-1 pt-2 pb-10">
                {/* Tombol Aksi Mengambang Kanan Atas (+ Counter & Urutkan A-Z) */}
                <div className="sticky top-22 z-20 float-right ml-4 flex flex-col items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Tambah gambar JPG, JPEG, atau PNG lagi"
                    aria-label="Tambah gambar lagi"
                    className="relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_8px_20px_rgba(225,29,72,0.35)] transition hover:scale-105 hover:bg-rose-700"
                  >
                    <svg
                      className="h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[10.5px] font-bold text-white ring-2 ring-white">
                      {images.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSortToggle}
                    title={
                      sortAsc
                        ? 'Urutkan nama file A ke Z'
                        : 'Urutkan nama file Z ke A'
                    }
                    aria-label="Urutkan daftar gambar berdasarkan nama"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
                  >
                    <span className="font-mono text-[11px] font-extrabold">
                      {sortAsc ? 'A↓Z' : 'Z↓A'}
                    </span>
                  </button>
                </div>

                {/* Grid Kartu Halaman Gambar */}
                <div className="grid grid-cols-1 gap-4 pr-14 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {images.map((item, index) => {
                    const { ratio, paddingClass } = getPageBoxStyle(item);
                    const isDragTarget = dragOverCardId === item.id;
                    const isQuarterTurn =
                      item.rotation === 90 || item.rotation === 270;

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => setDraggedCardId(item.id)}
                        onDragOver={(e) => {
                          if (!draggedCardId) return;
                          e.preventDefault();
                          if (dragOverCardId !== item.id) {
                            setDragOverCardId(item.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverCardId === item.id) {
                            setDragOverCardId(null);
                          }
                        }}
                        onDrop={(e) => {
                          if (!draggedCardId) return;
                          e.preventDefault();
                          handleCardDrop(item.id);
                        }}
                        onDragEnd={() => {
                          setDraggedCardId(null);
                          setDragOverCardId(null);
                        }}
                        className={`group relative flex flex-col rounded-2xl border bg-white p-3.5 shadow-[0_6px_22px_-8px_rgba(15,23,42,0.1)] transition-all duration-150 select-none ${
                          draggedCardId === item.id
                            ? 'scale-95 opacity-55'
                            : isDragTarget
                              ? 'border-rose-500 ring-2 ring-rose-500/30'
                              : 'border-slate-200/80 hover:border-slate-300 hover:shadow-[0_12px_28px_-10px_rgba(15,23,42,0.14)]'
                        }`}
                      >
                        {/* Bar Atas Kartu: Nomor Halaman & Tombol Aksi */}
                        <div className="mb-2.5 flex items-center justify-between gap-1">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-600">
                            Hal. {index + 1}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveImage(index, -1)}
                              disabled={index === 0}
                              title="Geser ke kiri"
                              aria-label="Geser ke kiri"
                              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                              >
                                <path d="m15 18-6-6 6-6" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveImage(index, 1)}
                              disabled={index === images.length - 1}
                              title="Geser ke kanan"
                              aria-label="Geser ke kanan"
                              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                              >
                                <path d="m9 18 6-6-6-6" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRotateImage(item.id)}
                              title="Putar 90°"
                              aria-label={`Putar gambar ${item.name}`}
                              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
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
                                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                                <path d="M21 3v6h-6" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setLightboxItem(item)}
                              title="Perbesar pratinjau"
                              aria-label={`Perbesar ${item.name}`}
                              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                              >
                                <circle cx="11" cy="11" r="7" />
                                <path d="m21 21-4.3-4.3" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(item.id)}
                              title="Hapus gambar ini"
                              aria-label={`Hapus ${item.name}`}
                              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                              >
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Area Pratinjau Kertas Live (WYSIWYG sesuai Orientasi & Margin) */}
                        <div className="flex h-48 cursor-grab items-center justify-center rounded-xl bg-slate-100/80 p-2.5 active:cursor-grabbing">
                          <div
                            style={{ aspectRatio: String(ratio) }}
                            className={`relative flex max-h-full max-w-full items-center justify-center overflow-hidden bg-white shadow-[0_2px_10px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 transition-all duration-200 ${
                              ratio >= 1 ? 'w-full' : 'h-full'
                            } ${paddingClass}`}
                          >
                            <div className="flex h-full w-full items-center justify-center overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.previewUrl}
                                alt={item.name}
                                draggable={false}
                                style={{
                                  transform: `rotate(${item.rotation}deg) ${
                                    isQuarterTurn ? 'scale(0.82)' : ''
                                  }`,
                                }}
                                className={`h-full w-full transition-transform duration-200 ${
                                  fitMode === 'cover' && pageSize !== 'fit'
                                    ? 'object-cover'
                                    : 'object-contain'
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Nama File & Info Format Live */}
                        <div className="mt-2.5 text-center">
                          <p
                            title={item.name}
                            className="truncate text-xs font-semibold text-slate-800"
                          >
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-[10.5px] font-medium text-slate-400">
                            {item.format} • {item.width}×{item.height}
                            {item.rotation > 0 ? ` • ${item.rotation}°` : ''}
                          </p>
                          {/* Tag Pengaturan Kertas & Margin Live */}
                          <div className="mt-1 flex items-center justify-center gap-1 text-[9.5px] font-medium text-rose-700">
                            <span className="rounded bg-rose-50 px-1.5 py-0.5 font-bold">
                              {pageSize.toUpperCase()}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                              {orientation === 'landscape' ? 'Lanskap' : 'Potret'}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                              {margin === 'none' ? '0 Margin' : margin === 'small' ? 'Margin Sedang' : 'Margin Besar'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Kartu Tambah Gambar Cepat di Akhir Grid */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-h-[258px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300/80 bg-white/55 p-5 text-center text-slate-500 transition hover:border-rose-400 hover:bg-white hover:text-rose-600"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                    <span className="text-xs font-bold">
                      Tambah Gambar Lainnya
                    </span>
                    <span className="text-[11px] text-slate-400">
                      JPG/JPEG/PNG tanpa batas
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* PANEL OPSI KANAN (Sesuai Contoh Gambar Referensi) */}
        <aside className="relative flex w-full shrink-0 flex-col justify-between border-t border-slate-200 bg-white lg:w-[365px] lg:border-t-0 lg:border-l xl:w-[390px]">
          <div className="space-y-6 p-6">
            <div className="border-b border-slate-100 pb-4 text-center">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-slate-900">
                Opsi JPG/JPEG/PNG ke PDF
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Sesuaikan tata letak halaman PDF Anda sebelum konversi
              </p>
            </div>

            {/* 1. Orientasi Halaman */}
            <div>
              <label className="mb-2.5 block text-xs font-bold tracking-wide text-slate-700">
                Orientasi halaman
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={pageSize === 'fit'}
                  onClick={() => setOrientation('portrait')}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    pageSize === 'fit'
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : orientation === 'portrait'
                        ? 'border-slate-700 bg-slate-50 text-slate-900 ring-1 ring-slate-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="h-5 w-3.5 rounded-[2px] border-2 border-current" />
                  <span>Potret</span>
                </button>

                <button
                  type="button"
                  disabled={pageSize === 'fit'}
                  onClick={() => setOrientation('landscape')}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    pageSize === 'fit'
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : orientation === 'landscape'
                        ? 'border-slate-700 bg-slate-50 text-slate-900 ring-1 ring-slate-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="h-3.5 w-5 rounded-[2px] border-2 border-current" />
                  <span>Lanskap</span>
                </button>

                <button
                  type="button"
                  disabled={pageSize === 'fit'}
                  onClick={() => setOrientation('auto')}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    pageSize === 'fit'
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : orientation === 'auto'
                        ? 'border-slate-700 bg-slate-50 text-slate-900 ring-1 ring-slate-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
                  </svg>
                  <span>Otomatis</span>
                </button>
              </div>
            </div>

            {/* 2. Ukuran Halaman */}
            <div>
              <label
                htmlFor="page-size-select"
                className="mb-2 block text-xs font-bold tracking-wide text-slate-700"
              >
                Ukuran halaman
              </label>
              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) =>
                  setPageSize(e.target.value as PageSizeOption)
                }
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 transition focus:border-rose-400 focus:ring-3 focus:ring-rose-500/10 focus:outline-none"
              >
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="fit">Sesuai Gambar (Ukuran Asli)</option>
                <option value="f4">F4 / Folio (215 × 330 mm)</option>
                <option value="letter">Letter (215,9 × 279,4 mm)</option>
                <option value="legal">Legal (215,9 × 355,6 mm)</option>
              </select>
            </div>

            {/* 3. Margin */}
            <div>
              <label className="mb-2.5 block text-xs font-bold tracking-wide text-slate-700">
                Margin
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMargin('none')}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    margin === 'none'
                      ? 'border-slate-700 bg-slate-50 text-slate-900 ring-1 ring-slate-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="m6 17 4-4 3 3 2-2 3 3" />
                  </svg>
                  <span>Tanpa Margin</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMargin('small')}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    margin === 'small'
                      ? 'border-slate-700 bg-slate-50 text-slate-900 ring-1 ring-slate-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="16"
                      rx="2"
                      strokeDasharray="2 2"
                    />
                    <rect x="6.5" y="7" width="11" height="10" rx="1" />
                  </svg>
                  <span>Kecil</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMargin('big')}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    margin === 'big'
                      ? 'border-slate-700 bg-slate-50 text-slate-900 ring-1 ring-slate-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="16"
                      rx="2"
                      strokeDasharray="2 2"
                    />
                    <rect x="8.5" y="8.5" width="7" height="7" rx="1" />
                  </svg>
                  <span>Besar</span>
                </button>
              </div>
            </div>

            {/* 4. Penyesuaian & Kualitas Gambar */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {pageSize !== 'fit' && (
                <div>
                  <label className="mb-2 block text-xs font-bold tracking-wide text-slate-700">
                    Penyesuaian gambar
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFitMode('contain')}
                      className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        fitMode === 'contain'
                          ? 'border-slate-700 bg-slate-50 text-slate-900 ring-1 ring-slate-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      Utuh (Proporsional)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFitMode('cover')}
                      className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        fitMode === 'cover'
                          ? 'border-slate-700 bg-slate-50 text-slate-900 ring-1 ring-slate-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      Penuhi Halaman
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-bold tracking-wide text-slate-700">
                  Kualitas &amp; ukuran file
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'original' as const, label: 'Asli' },
                    { id: 'balanced' as const, label: 'Seimbang' },
                    { id: 'compact' as const, label: 'Ringkas' },
                  ].map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setQuality(q.id)}
                      className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                        quality === q.id
                          ? 'border-slate-700 bg-slate-50 text-slate-900 ring-1 ring-slate-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Nama File Output */}
            <div>
              <label
                htmlFor="output-filename"
                className="mb-2 block text-xs font-bold tracking-wide text-slate-700"
              >
                Nama file hasil
              </label>
              <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-rose-400 focus-within:ring-3 focus-within:ring-rose-500/10">
                <input
                  id="output-filename"
                  type="text"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  placeholder="ScorpioPDF-Gambar"
                  className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                <span className="border-l border-slate-100 bg-slate-50 px-3 py-2.5 font-mono text-xs font-bold text-slate-500">
                  {mergeAll || images.length <= 1 ? '.pdf' : '.zip'}
                </span>
              </div>
            </div>

            {/* 6. Checkbox Gabungkan Semua Gambar */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={mergeAll}
                  onChange={(e) => setMergeAll(e.target.checked)}
                  className="mt-0.5 h-4.5 w-4.5 cursor-pointer rounded border-slate-300 accent-rose-600"
                />
                <span className="text-xs leading-relaxed font-semibold text-slate-700">
                  Gabungkan semua gambar dalam satu file PDF
                </span>
              </label>
              {!mergeAll && images.length > 1 && (
                <p className="mt-2 pl-7 text-[11px] leading-relaxed text-slate-500">
                  Setiap gambar akan menjadi 1 file PDF terpisah dan dikemas
                  dalam arsip ZIP.
                </p>
              )}
            </div>
          </div>

          {/* Footer CTA Sidebar (dengan aksen lembut di bagian bawah seperti contoh) */}
          <div className="sticky bottom-0 border-t border-rose-100 bg-gradient-to-t from-rose-50/90 via-rose-50/50 to-white p-6">
            {isConverting && progress && (
              <div className="mb-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  <span className="truncate pr-2">
                    Memproses {progress.fileName}...
                  </span>
                  <span>
                    {progress.current}/{progress.total}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-rose-100">
                  <div
                    className="h-full rounded-full bg-rose-600 transition-all duration-200"
                    style={{
                      width: `${Math.round(
                        (progress.current / progress.total) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={images.length === 0 || isConverting}
              onClick={handleConvert}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-rose-600 px-6 py-4 text-base font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              <span>
                {isConverting ? 'Mengonversi ke PDF...' : 'Konversi ke PDF'}
              </span>
              {!isConverting && (
                <svg
                  className="h-5 w-5 rounded-full border border-white/50 p-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              )}
            </button>
          </div>
        </aside>
      </main>

      {/* Lightbox Perbesar Gambar */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {lightboxItem.name}
                </p>
                <p className="text-xs text-slate-500">
                  {lightboxItem.format} • {lightboxItem.width}×
                  {lightboxItem.height} • {formatBytes(lightboxItem.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="cursor-pointer rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
            <div className="flex max-h-[74vh] items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxItem.previewUrl}
                alt={lightboxItem.name}
                style={{ transform: `rotate(${lightboxItem.rotation}deg)` }}
                className="max-h-[68vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

