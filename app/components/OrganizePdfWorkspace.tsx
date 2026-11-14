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
  executeOrganizePdf,
  formatBytes,
  GeneratedOrganizeResult,
  inspectPdfForOrganize,
  InspectOrganizePdfResult,
  OrganizePageItem,
  sanitizePdfFilename,
  stripPdfExtension,
} from '@/app/lib/organize-pdf';
import { Navbar } from './Navbar';

export function OrganizePdfWorkspace() {
  // Berkas PDF Sumber
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspectData, setInspectData] = useState<InspectOrganizePdfResult | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Daftar Kartu Halaman yang Sedang Disusun (Urutan, Rotasi, Duplikasi)
  const [pages, setPages] = useState<OrganizePageItem[]>([]);

  // Opsi Berkas Output
  const [outputName, setOutputName] = useState<string>('');

  // Status Eksekusi
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<{ current: number; total: number; message: string } | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);

  // Hasil Eksekusi
  const [result, setResult] = useState<GeneratedOrganizeResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Drag & Drop File Upload
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Drag & Drop Reordering Halaman di Grid
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Modal zoom pratinjau halaman
  const [activeZoomPage, setActiveZoomPage] = useState<OrganizePageItem | null>(null);

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
      setOutputName(`${stripPdfExtension(file.name)}-tersusun`);

      try {
        const inspected = await inspectPdfForOrganize(file, (loaded, total) => {
          setLoadProgress({ loaded, total });
        });

        inspected.pages.forEach((p) => {
          if (p.thumbnailUrl) activeThumbnailsRef.current.push(p.thumbnailUrl);
        });

        setInspectData(inspected);
        setPages(inspected.pages);
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Gagal memuat dan menganalisis berkas PDF. Pastikan file tidak rusak atau terkunci sandi.'
        );
        setSelectedFile(null);
        setInspectData(null);
        setPages([]);
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
    setPages([]);
    setLoadError(null);
    setProcessError(null);
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

  // Drag & Drop File Upload
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

  // =========================================================================
  // MANIPULASI KARTU HALAMAN (REORDER, ROTATE, DUPLICATE, DELETE)
  // =========================================================================

  // Geser Halaman Mundur (Shift Left)
  const handleMoveLeft = (index: number) => {
    if (index <= 0) return;
    setPages((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
    clearResult();
  };

  // Geser Halaman Maju (Shift Right)
  const handleMoveRight = (index: number) => {
    if (index >= pages.length - 1) return;
    setPages((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
    clearResult();
  };

  // Putar Satu Halaman +90 Derajat
  const handleRotatePage = (index: number) => {
    setPages((prev) => {
      const next = [...prev];
      const currentRot = next[index].rotation || 0;
      next[index] = {
        ...next[index],
        rotation: (currentRot + 90) % 360,
      };
      return next;
    });
    clearResult();
  };

  // Duplikasi Satu Halaman
  const handleDuplicatePage = (index: number) => {
    setPages((prev) => {
      const next = [...prev];
      const itemToDup = next[index];
      const duplicatedItem: OrganizePageItem = {
        ...itemToDup,
        id: `dup-${itemToDup.sourcePageNum}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };
      next.splice(index + 1, 0, duplicatedItem);
      return next;
    });
    clearResult();
  };

  // Hapus Satu Halaman dari Susunan
  const handleDeletePage = (index: number) => {
    if (pages.length <= 1) {
      setProcessError('Dokumen harus menyisakan minimal 1 halaman.');
      return;
    }
    setPages((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    clearResult();
  };

  // Drag-and-Drop Card Reordering
  const handleCardDragStart = (index: number) => {
    setDraggedPageIndex(index);
  };

  const handleCardDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedPageIndex === null || draggedPageIndex === index) return;
    setDragOverIndex(index);
  };

  const handleCardDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedPageIndex === null || draggedPageIndex === targetIndex) {
      setDraggedPageIndex(null);
      setDragOverIndex(null);
      return;
    }

    setPages((prev) => {
      const next = [...prev];
      const [draggedItem] = next.splice(draggedPageIndex, 1);
      next.splice(targetIndex, 0, draggedItem);
      return next;
    });

    setDraggedPageIndex(null);
    setDragOverIndex(null);
    clearResult();
  };

  // Aksi Cepat: Balikkan Seluruh Urutan Halaman (Reverse N...1)
  const handleReverseOrder = () => {
    setPages((prev) => [...prev].reverse());
    clearResult();
  };

  // Aksi Cepat: Kembalikan ke Urutan Halaman Asli
  const handleResetToOriginalOrder = () => {
    if (!inspectData) return;
    setPages([...inspectData.pages]);
    clearResult();
  };

  // Aksi Cepat: Putar Semua Halaman +90 Derajat
  const handleRotateAllClockwise = () => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + 90) % 360,
      }))
    );
    clearResult();
  };

  // Aksi Cepat: Putar Semua Halaman -90 Derajat
  const handleRotateAllCounterClockwise = () => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + 270) % 360,
      }))
    );
    clearResult();
  };

  // Aksi Cepat: Reset Semua Rotasi Menjadi 0 Derajat
  const handleResetAllRotations = () => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: 0,
      }))
    );
    clearResult();
  };

  // Eksekusi Penyusunan PDF
  const handleStartOrganize = async () => {
    if (!selectedFile || pages.length === 0) return;

    setProcessError(null);
    clearResult();
    setIsProcessing(true);
    setProcessStatus({ current: 1, total: 4, message: 'Menyiapkan dokumen...' });

    try {
      const res = await executeOrganizePdf(
        [selectedFile],
        pages,
        outputName || `${stripPdfExtension(selectedFile.name)}-tersusun`,
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
          : 'Terjadi kesalahan saat menyusun dan menyimpan berkas PDF baru.'
      );
    } finally {
      setIsProcessing(false);
      setProcessStatus(null);
    }
  };

  const totalPagesOriginal = inspectData?.pageCount || 0;
  const currentTotalPages = pages.length;
  const hasRotatedPages = pages.some((p) => p.rotation !== 0);

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
            <span className="text-slate-400">ATUR PDF</span>
            <span>/</span>
            <span className="font-bold text-slate-900">Susun PDF</span>
          </div>

          {/* Indikator Berkas Saat Dokumen Sudah Dimuat */}
          {inspectData && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-2xs border border-slate-200">
                <span className="text-coral-600 font-extrabold">🗂️</span>
                <span className="max-w-[200px] truncate">{inspectData.fileName}</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  ({currentTotalPages} Halaman Aktif • {formatBytes(inspectData.fileSize)})
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
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/90 bg-orange-50/80 px-3.5 py-1 text-xs font-bold text-orange-800 uppercase tracking-wider shadow-2xs">
            <svg className="h-3.5 w-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            STUDIO SUSUN HALAMAN • Tata Letak &amp; Rotasi Visual
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">
            Susun Ulang, Putar, &amp; <span className="text-orange-600">Rapikan Halaman PDF</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Ubah urutan lembar halaman, balikkan urutan dokumen hasil scan, putar orientasi halaman yang miring, atau duplikasi lembar penting dengan kontrol visual interaktif. Seluruh konten teks dan gambar terjaga 100%.
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
                  ? 'border-orange-500 bg-orange-50/70 shadow-2xl scale-[1.01]'
                  : 'border-slate-300/80 bg-white/95 shadow-xl shadow-slate-200/50 hover:border-orange-400 hover:bg-white hover:shadow-2xl hover:scale-[1.005]'
              }`}
            >
              {/* Visual Icon */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-500/30 transition-transform duration-300 group-hover:scale-110">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md border-2 border-white">
                  <span className="text-[10px] font-black font-mono">ORG</span>
                </div>
              </div>

              {isLoadingPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-orange-600 border-t-transparent" />
                  <p className="text-base font-semibold text-slate-700">
                    Memuat dan menganalisis seluruh lembar halaman PDF...
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
                    Unggah berkas dokumen PDF yang ingin Anda tata ulang urutan dan orientasi halamannya. Anda juga dapat menempel berkas langsung dengan <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 border border-slate-300">Ctrl + V</kbd>.
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
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      <span>Drag &amp; Drop Geser Halaman</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span>Putar 90°, Duplikasi &amp; Balikkan Scan</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 2: FILE SUDAH DIMUAT (STUDIO SUSUN HALAMAN INTERAKTIF) */}
        {/* ========================================================================================= */}
        {inspectData && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Kolom Kiri: Grid Visual Kartu Halaman (lg:col-span-8) */}
            <div className="space-y-4 lg:col-span-8">
              {/* Toolbar Aksi Cepat Batch (Urutkan & Putar) */}
              <div className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Studio Tata Letak Halaman
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tarik &amp; lepas kartu halaman untuk mengubah urutan, atau gunakan tombol kontrol di setiap kartu.
                    </p>
                  </div>

                  {/* Tombol Balikkan Urutan (Scan Reverse) */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={handleReverseOrder}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-bold text-slate-700 hover:border-slate-300 hover:bg-white transition cursor-pointer flex items-center gap-1"
                      title="Membalik urutan halaman (misal dokumen scan yang terbalik)"
                    >
                      <span>🔄 Balikkan Urutan</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetToOriginalOrder}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600 hover:border-slate-300 hover:bg-white transition cursor-pointer"
                      title="Kembalikan urutan kartu ke nomor aslinya"
                    >
                      Urutan Asli
                    </button>
                  </div>
                </div>

                {/* Sub-toolbar Rotasi Massal */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Rotasi Massal:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleRotateAllClockwise}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 hover:bg-white transition cursor-pointer font-medium"
                    >
                      ↻ Putar Semua +90°
                    </button>
                    <button
                      type="button"
                      onClick={handleRotateAllCounterClockwise}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 hover:bg-white transition cursor-pointer font-medium"
                    >
                      ↺ Putar Semua -90°
                    </button>
                    {hasRotatedPages && (
                      <button
                        type="button"
                        onClick={handleResetAllRotations}
                        className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-800 hover:bg-orange-100 transition cursor-pointer font-bold"
                      >
                        Reset Rotasi (0°)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid Visual Seluruh Halaman dengan Dukungan Drag-and-Drop */}
              <div className="rounded-3xl border border-slate-200/90 bg-slate-100/70 p-4 sm:p-6 shadow-inner max-h-[640px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {pages.map((item, index) => {
                    const isBeingDragged = draggedPageIndex === index;
                    const isDragOver = dragOverIndex === index;
                    const rotationDeg = item.rotation || 0;

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => handleCardDragStart(index)}
                        onDragOver={(e) => handleCardDragOver(e, index)}
                        onDrop={(e) => handleCardDrop(e, index)}
                        className={`group relative flex flex-col items-center rounded-2xl border bg-white p-2.5 shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                          isBeingDragged
                            ? 'opacity-40 scale-95 border-dashed border-orange-500'
                            : isDragOver
                            ? 'border-orange-500 ring-2 ring-orange-500/30 scale-[1.02]'
                            : 'border-slate-200/90 hover:border-orange-400 hover:shadow-md'
                        }`}
                      >
                        {/* Header Mini Kartu: Nomor Lembar & Asli */}
                        <div className="mb-2 flex w-full items-center justify-between text-[11px] font-bold px-1">
                          <span className="rounded-md bg-orange-100 text-orange-950 px-1.5 py-0.5 font-mono text-[10px]">
                            Lembar #{index + 1}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Hal Asli: {item.sourcePageNum}
                          </span>
                        </div>

                        {/* Thumbnail Halaman dengan Rotasi CSS */}
                        <div className="relative w-full overflow-hidden rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1 min-h-[140px]">
                          {item.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.thumbnailUrl}
                              alt={`Halaman ${item.sourcePageNum}`}
                              style={{
                                transform: `rotate(${rotationDeg}deg)`,
                                transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                              }}
                              className="max-h-36 w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-36 w-full items-center justify-center text-xs text-slate-300">
                              Halaman {item.sourcePageNum}
                            </div>
                          )}

                          {/* Badge Indikator Rotasi Jika Ada */}
                          {rotationDeg !== 0 && (
                            <div className="absolute top-1.5 right-1.5 rounded-md bg-orange-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-xs">
                              ⟳ +{rotationDeg}°
                            </div>
                          )}

                          {/* Tombol Perbesar Zoom Pojok Kiri Bawah */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveZoomPage(item);
                            }}
                            className="absolute bottom-1.5 left-1.5 rounded-lg bg-slate-900/70 p-1 text-white opacity-0 group-hover:opacity-100 hover:bg-slate-900 transition shadow"
                            title="Perbesar Pratinjau Halaman"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </button>
                        </div>

                        {/* Action Bar Bawah Kartu: Geser Kiri/Kanan, Putar, Duplikasi, Hapus */}
                        <div className="mt-2.5 grid grid-cols-5 gap-1 w-full pt-1.5 border-t border-slate-100">
                          {/* Geser Kiri */}
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveLeft(index);
                            }}
                            className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-950 transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                            title="Geser Halaman ke Kiri"
                          >
                            <span className="font-bold text-xs">←</span>
                          </button>

                          {/* Putar 90° */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotatePage(index);
                            }}
                            className="rounded-lg p-1 text-orange-700 hover:bg-orange-50 hover:text-orange-950 transition cursor-pointer flex items-center justify-center"
                            title="Putar 90° Searah Jarum Jam"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>

                          {/* Duplikasi Halaman */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicatePage(index);
                            }}
                            className="rounded-lg p-1 text-blue-700 hover:bg-blue-50 hover:text-blue-950 transition cursor-pointer flex items-center justify-center"
                            title="Duplikasi Halaman Ini"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                          </button>

                          {/* Hapus Halaman */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePage(index);
                            }}
                            className="rounded-lg p-1 text-rose-600 hover:bg-rose-50 hover:text-rose-900 transition cursor-pointer flex items-center justify-center"
                            title="Hapus Halaman Ini dari Susunan"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>

                          {/* Geser Kanan */}
                          <button
                            type="button"
                            disabled={index === pages.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveRight(index);
                            }}
                            className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-950 transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                            title="Geser Halaman ke Kanan"
                          >
                            <span className="font-bold text-xs">→</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Panel Ringkasan Susunan & Tombol Aksi (lg:col-span-4) */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-6 sticky top-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Ringkasan Susunan
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Pastikan urutan dan rotasi telah sesuai sebelum menyimpan
                  </p>
                </div>

                {/* Kotak Statistik Halaman Real-Time */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Jumlah Halaman Awal:</span>
                    <span className="font-extrabold text-slate-900 font-mono">
                      {totalPagesOriginal} Halaman
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-orange-700 font-bold flex items-center gap-1">
                      <span>🗂️</span> Jumlah Halaman Akhir:
                    </span>
                    <span className="font-extrabold text-orange-700 font-mono text-base">
                      {currentTotalPages} Halaman
                    </span>
                  </div>

                  {hasRotatedPages && (
                    <div className="text-[11px] text-orange-800 bg-orange-50 rounded-xl p-2.5 border border-orange-200 flex items-center gap-1.5 font-medium">
                      <span>⟳</span> Terdapat halaman dengan rotasi khusus yang akan diterapkan.
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                    💡 <em>Tip: Anda dapat menarik kartu langsung (drag &amp; drop) untuk menyusun halaman dengan bebas.</em>
                  </div>
                </div>

                {/* Pengaturan Nama File Output */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nama File PDF Tersusun
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="dokumen-tersusun"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-12 text-xs font-semibold text-slate-800 transition focus:border-orange-500 focus:bg-white focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-xs font-bold text-orange-600">
                      .pdf
                    </span>
                  </div>
                </div>

                {/* Progres Penyusunan */}
                {isProcessing && processStatus && (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-orange-900">
                      <span>{processStatus.message}</span>
                      <span>{Math.round((processStatus.current / processStatus.total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-orange-200">
                      <div
                        className="h-full bg-orange-600 transition-all duration-300"
                        style={{
                          width: `${(processStatus.current / processStatus.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Tombol CTA Utama (Rose Merah Menonjol Khas ScorpioPDF) */}
                <button
                  type="button"
                  onClick={handleStartOrganize}
                  disabled={isProcessing || currentTotalPages === 0}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all duration-200 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Menyusun Dokumen Baru...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                      </svg>
                      <span>Terapkan &amp; Simpan PDF Baru</span>
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
          <div className="mt-8 rounded-3xl border border-orange-200 bg-white p-6 sm:p-8 shadow-xl shadow-orange-500/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-md shadow-orange-600/30">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-orange-800 bg-orange-50 px-2.5 py-0.5 rounded-full uppercase">
                      Penyusunan Berhasil
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
                  <span>Unduh File PDF Tersusun Sekarang</span>
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

            {/* Statistik Hasil Penyusunan */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Halaman Asli</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {totalPagesOriginal} Hal
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Halaman Tersusun</div>
                <div className="text-2xl font-black text-orange-700 mt-1">
                  {result.pageCount} Hal
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Status Perubahan</div>
                <div className="text-xs sm:text-sm font-bold text-emerald-700 mt-2">
                  {result.hasRotations ? 'Rotasi & Urutan Baru' : 'Urutan Baru Diterapkan'}
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
        {activeZoomPage !== null && (
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
                  Pratinjau Halaman Asli: Hal {activeZoomPage.sourcePageNum}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveZoomPage(null)}
                  className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              {activeZoomPage.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeZoomPage.thumbnailUrl}
                  alt={`Halaman ${activeZoomPage.sourcePageNum}`}
                  style={{
                    transform: `rotate(${activeZoomPage.rotation || 0}deg)`,
                  }}
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
