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
  executeMergePdf,
  formatBytes,
  GeneratedMergeResult,
  inspectPdfForMerge,
  ManagedMergePdfItem,
  MERGE_ORIENTATIONS,
  MERGE_PAGE_NUMBERINGS,
  MERGE_PAGE_SIZES,
  MergeOrientation,
  MergePageNumbering,
  MergePdfOptions,
  MergeStandardPageSize,
  parsePageRangeToIndices,
  stripPdfExtension,
} from '@/app/lib/merge-pdf';
import { Navbar } from './Navbar';

export function MergePdfWorkspace() {
  const [items, setItems] = useState<ManagedMergePdfItem[]>([]);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Opsi Penggabungan
  const [standardPageSize, setStandardPageSize] =
    useState<MergeStandardPageSize>('original');
  const [orientation, setOrientation] = useState<MergeOrientation>('keep');
  const [pageNumbering, setPageNumbering] =
    useState<MergePageNumbering>('none');
  const [addBlankSeparator, setAddBlankSeparator] = useState<boolean>(false);
  const [outputName, setOutputName] = useState<string>('');

  // Mode Tampilan Pratinjau: 'grid' (kelola kartu) atau 'flow' (simulasi alur gabungan)
  const [previewViewMode, setPreviewViewMode] = useState<'grid' | 'flow'>('grid');

  // Status Drag & Drop File Baru
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Drag and Drop Pengurutan Kartu
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // Status Penggabungan
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Hasil Gabung
  const [result, setResult] = useState<GeneratedMergeResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Lightbox Modal
  const [lightboxItem, setLightboxItem] = useState<ManagedMergePdfItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);
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

  // Tutup Lightbox dengan Escape
  useEffect(() => {
    if (!lightboxItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxItem]);

  const clearResult = useCallback(() => {
    if (activeResultUrlRef.current) {
      URL.revokeObjectURL(activeResultUrlRef.current);
      activeResultUrlRef.current = null;
    }
    setResultUrl(null);
    setResult(null);
  }, []);

  const handleAddFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(
        (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
      );

      if (files.length === 0) {
        setLoadError('Pilih file dokumen PDF yang valid (.pdf).');
        return;
      }

      setLoadError(null);
      setMergeError(null);
      clearResult();
      setIsLoadingPdf(true);

      try {
        const newItems: ManagedMergePdfItem[] = [];
        for (const file of files) {
          const inspected = await inspectPdfForMerge(file);
          if (inspected.thumbnailUrl) {
            activeThumbUrlsRef.current.add(inspected.thumbnailUrl);
          }
          newItems.push(inspected);
        }

        setItems((prev) => {
          const combined = [...prev, ...newItems];
          if (!outputName) {
            setOutputName(`Gabungan-${combined.length}-Dokumen`);
          }
          return combined;
        });
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? `Gagal membaca file PDF: ${err.message}`
            : 'Satu atau beberapa file PDF tidak dapat diproses karena rusak atau terkunci password.'
        );
      } finally {
        setIsLoadingPdf(false);
      }
    },
    [clearResult, outputName]
  );

  // Dukungan Ctrl + V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      const pdfs = Array.from(e.clipboardData.files).filter(
        (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
      );
      if (pdfs.length > 0) {
        e.preventDefault();
        handleAddFiles(pdfs);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleAddFiles]);

  // Drag & Drop File Eksternal
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
      handleAddFiles(e.dataTransfer.files);
    }
  };

  // Reordering Kartu (Pindah Urutan)
  const handleCardDrop = (targetId: string) => {
    if (!draggedCardId || draggedCardId === targetId) return;

    setItems((prev) => {
      const fromIdx = prev.findIndex((item) => item.id === draggedCardId);
      const toIdx = prev.findIndex((item) => item.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });

    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleMoveItem = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    setItems((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      if (filtered.length === 0) {
        clearResult();
      }
      return filtered;
    });
  };

  const handleRotateItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newRot = (item.rotation + 90) % 360;
          return { ...item, rotation: newRot };
        }
        return item;
      })
    );
  };

  const handleUpdatePageRange = (id: string, rangeStr: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const indices = parsePageRangeToIndices(rangeStr, item.pageCount);
          return {
            ...item,
            customPageRange: rangeStr,
            activePagesCount: indices.length,
          };
        }
        return item;
      })
    );
  };

  const handleToggleRangeMode = (id: string, mode: 'all' | 'custom') => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const activeCount =
            mode === 'custom' && item.customPageRange.trim()
              ? parsePageRangeToIndices(item.customPageRange, item.pageCount).length
              : item.pageCount;
          return {
            ...item,
            pageRangeMode: mode,
            activePagesCount: activeCount,
          };
        }
        return item;
      })
    );
  };

  // Quick Sort Tools
  const handleSortByNameAsc = () => {
    setItems((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name, 'id-ID')));
  };

  const handleSortByNameDesc = () => {
    setItems((prev) => [...prev].sort((a, b) => b.name.localeCompare(a.name, 'id-ID')));
  };

  const handleSortBySizeAsc = () => {
    setItems((prev) => [...prev].sort((a, b) => a.size - b.size));
  };

  const handleSortBySizeDesc = () => {
    setItems((prev) => [...prev].sort((a, b) => b.size - a.size));
  };

  const handleReverseOrder = () => {
    setItems((prev) => [...prev].reverse());
  };

  const handleResetAll = () => {
    clearResult();
    items.forEach((it) => {
      if (it.thumbnailUrl) URL.revokeObjectURL(it.thumbnailUrl);
    });
    activeThumbUrlsRef.current.clear();
    setItems([]);
    setLoadError(null);
    setMergeError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (appendFileInputRef.current) appendFileInputRef.current.value = '';
  };

  // Eksekusi Penggabungan
  const handleStartMerge = async () => {
    if (items.length < 2) {
      setMergeError('Tambahkan minimal 2 file PDF untuk digabungkan.');
      return;
    }

    setMergeError(null);
    clearResult();
    setIsMerging(true);
    setProgress({ current: 0, total: items.length });

    try {
      const options: MergePdfOptions = {
        standardPageSize,
        orientation,
        pageNumbering,
        addBlankSeparator,
        outputName,
      };

      const res = await executeMergePdf(
        items,
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
      setMergeError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menggabungkan file PDF. Pastikan dokumen tidak terkunci password.'
      );
    } finally {
      setIsMerging(false);
      setProgress(null);
    }
  };

  // Hitung distribusi kumulatif halaman & nomor halaman untuk simulasi live WYSIWYG
  let cumulativePage = 1;
  const itemDistributions = items.map((item, idx) => {
    const startPage = cumulativePage;
    const count = Math.max(0, item.activePagesCount);
    const endPage = count > 0 ? startPage + count - 1 : startPage;
    cumulativePage = count > 0 ? endPage + 1 : cumulativePage;

    const hasSeparator = addBlankSeparator && idx < items.length - 1;
    const separatorPage = hasSeparator ? cumulativePage : null;
    if (hasSeparator) {
      cumulativePage++;
    }

    return {
      item,
      index: idx,
      startPage,
      endPage,
      count,
      hasSeparator,
      separatorPage,
    };
  });
  const totalCalculatedPages = cumulativePage - 1;

  // Rasio Aspek Kertas Dinamis Berdasarkan Opsi yang Dipilih
  const getPageAspectRatio = (widthPt: number, heightPt: number) => {
    const isLandscape =
      orientation === 'landscape'
        ? true
        : orientation === 'portrait'
        ? false
        : widthPt > heightPt;

    if (standardPageSize === 'a4') {
      return isLandscape ? '1.414 / 1' : '1 / 1.414';
    }
    if (standardPageSize === 'f4') {
      return isLandscape ? '1.535 / 1' : '1 / 1.535';
    }
    if (standardPageSize === 'letter') {
      return isLandscape ? '1.294 / 1' : '1 / 1.294';
    }

    // Original size
    if (orientation === 'landscape') {
      const maxDim = Math.max(widthPt || 595, heightPt || 842);
      const minDim = Math.min(widthPt || 595, heightPt || 842);
      return `${maxDim} / ${minDim}`;
    }
    if (orientation === 'portrait') {
      const maxDim = Math.max(widthPt || 595, heightPt || 842);
      const minDim = Math.min(widthPt || 595, heightPt || 842);
      return `${minDim} / ${maxDim}`;
    }

    return `${widthPt || 595} / ${heightPt || 842}`;
  };

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
          <span className="font-bold text-slate-900">Gabung PDF</span>
        </div>

        {/* Hero Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/90 bg-rose-50/80 px-3.5 py-1 text-xs font-bold text-rose-800 uppercase tracking-wider shadow-2xs">
            <svg className="h-3.5 w-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            ATUR PDF • Gabung Banyak File
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">
            Gabung <span className="text-rose-600">Beberapa File PDF</span> Jadi Satu
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Gabungkan beberapa dokumen PDF sesuai urutan yang Anda inginkan dengan mudah. Atur rentang halaman per file, seragamkan ukuran kertas (A4/F4), dan beri nomor halaman otomatis langsung di browser Anda.
          </p>
        </div>

        {/* Notifikasi Error Membaca File */}
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
        {items.length === 0 && (
          <div className="mx-auto w-full max-w-3xl">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleAddFiles(e.target.files);
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md border-2 border-white">
                  <span className="text-[11px] font-extrabold">+</span>
                </div>
              </div>

              {isLoadingPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-rose-600 border-t-transparent" />
                  <p className="text-base font-semibold text-slate-700">
                    Menganalisis file dokumen PDF...
                  </p>
                  <p className="text-xs text-slate-400">
                    Menghitung halaman dan menyiapkan pratinjau
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 group-hover:text-rose-600 transition">
                    Pilih Beberapa File PDF untuk Digabungkan
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 max-w-md">
                    Pilih 2 atau lebih file <code className="text-rose-700 font-semibold font-mono">.pdf</code>, seret & letakkan ke sini, atau tekan <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">Ctrl + V</kbd>.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Bebas Urutkan File (Drag & Drop)
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Pilih Halaman Tertentu per File
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Seragamkan A4 / F4
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
        {items.length > 0 && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Input Tersembunyi Tambah File */}
            <input
              ref={appendFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleAddFiles(e.target.files);
                }
              }}
              className="hidden"
            />

            {/* Kolom Kiri: Daftar Kartu PDF, Alur Dokumen & Pengurutan (lg:col-span-8) */}
            <div className="space-y-6 lg:col-span-8">
              {/* Toolbar Atas: Statistik Dokumen & Tombol Sortir */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-xs font-black text-rose-700">
                    {items.length}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      {items.length} Dokumen PDF
                    </span>
                    <span className="mx-1.5 text-slate-300">•</span>
                    <span className="text-xs text-slate-500">
                      Total <strong className="font-semibold text-rose-700">{totalCalculatedPages} Halaman</strong> akan digabung
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Mode Tampilan Tab */}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold text-slate-700 mr-2">
                    <button
                      type="button"
                      onClick={() => setPreviewViewMode('grid')}
                      className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                        previewViewMode === 'grid'
                          ? 'bg-white text-rose-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Kartu File
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewMode('flow')}
                      className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                        previewViewMode === 'flow'
                          ? 'bg-white text-rose-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Alur Urutan
                    </button>
                  </div>

                  {/* Tombol Sortir Cepat */}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold text-slate-700">
                    <button
                      onClick={handleSortByNameAsc}
                      className="rounded-lg px-2 py-1 hover:bg-white hover:shadow-2xs transition cursor-pointer"
                      title="Urutkan nama file A ke Z"
                    >
                      A→Z
                    </button>
                    <button
                      onClick={handleSortByNameDesc}
                      className="rounded-lg px-2 py-1 hover:bg-white hover:shadow-2xs transition cursor-pointer"
                      title="Urutkan nama file Z ke A"
                    >
                      Z→A
                    </button>
                    <button
                      onClick={handleSortBySizeAsc}
                      className="rounded-lg px-2 py-1 hover:bg-white hover:shadow-2xs transition cursor-pointer"
                      title="Urutkan file terkecil"
                    >
                      Kecil
                    </button>
                    <button
                      onClick={handleSortBySizeDesc}
                      className="rounded-lg px-2 py-1 hover:bg-white hover:shadow-2xs transition cursor-pointer"
                      title="Urutkan file terbesar"
                    >
                      Besar
                    </button>
                    <button
                      onClick={handleReverseOrder}
                      className="rounded-lg px-2 py-1 hover:bg-white hover:shadow-2xs transition text-rose-600 cursor-pointer"
                      title="Balikkan urutan file"
                    >
                      ⇄ Balik
                    </button>
                  </div>

                  {/* Tombol Tambah PDF Lagi */}
                  <button
                    onClick={() => appendFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Tambah PDF</span>
                  </button>

                  <button
                    onClick={handleResetAll}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition cursor-pointer"
                    title="Hapus semua dokumen"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* BAR STATUS PILIHAN OPSI AKTIF (LIVE PRATINJAU STATUS) */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
                  Status Opsi Pratinjau:
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                  <span className="text-slate-400 font-normal">Kertas:</span>
                  <span className="text-rose-700">
                    {standardPageSize === 'original' ? 'Ukuran Asli' : standardPageSize.toUpperCase()}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                  <span className="text-slate-400 font-normal">Orientasi:</span>
                  <span className="text-rose-700">
                    {orientation === 'keep' ? 'Sesuai Asli' : orientation === 'portrait' ? 'Tegak (Portrait)' : 'Mendatar (Landscape)'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                  <span className="text-slate-400 font-normal">Penomoran:</span>
                  <span className="text-rose-700">
                    {pageNumbering === 'none' ? 'Tanpa Nomor' : MERGE_PAGE_NUMBERINGS[pageNumbering].tag}
                  </span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold shadow-2xs transition-colors ${
                    addBlankSeparator
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span className="text-slate-400 font-normal">Pemisah Kosong:</span>
                  <span>{addBlankSeparator ? `Aktif (+${items.length - 1} Hal)` : 'Nonaktif'}</span>
                </span>
              </div>

              {/* TAMPILAN 1: GRID KARTU FILE DOKUMEN DENGAN ELEMEN PREVIEW LENGKAP */}
              {previewViewMode === 'grid' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {itemDistributions.map((dist) => {
                    const item = dist.item;
                    const index = dist.index;
                    const isDragTarget = dragOverCardId === item.id;
                    const isQuarterTurn = item.rotation === 90 || item.rotation === 270;

                    return (
                      <div key={item.id} className="contents">
                        {/* KARTU DOKUMEN UTAMA */}
                        <div
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
                          className={`group relative flex flex-col rounded-2xl border-2 bg-white p-3.5 shadow-sm transition-all duration-150 select-none ${
                            draggedCardId === item.id
                              ? 'scale-95 opacity-50 border-rose-300'
                              : isDragTarget
                              ? 'border-rose-500 bg-rose-50/40 scale-[1.02] shadow-md ring-2 ring-rose-500/20'
                              : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
                          }`}
                        >
                          {/* Header Kartu: Nomor Urut & Aksi Cepat */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-600 text-[10px] font-black text-white shadow-2xs">
                                {index + 1}
                              </span>
                              <span className="text-[10px] font-bold text-slate-800">
                                Urutan #{index + 1}
                              </span>
                              <span className="rounded bg-rose-50 border border-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">
                                Hal {dist.startPage}–{dist.endPage}
                              </span>
                            </div>

                            {/* Tombol Geser Kiri / Kanan */}
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleMoveItem(index, 'left')}
                                disabled={index === 0}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                title="Geser ke kiri / urutan sebelumnya"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveItem(index, 'right')}
                                disabled={index === items.length - 1}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                title="Geser ke kanan / urutan berikutnya"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRotateItem(item.id)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                                title="Putar 90° searah jarum jam"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setLightboxItem(item)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                                title="Perbesar sampul halaman"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                                title="Hapus file ini dari daftar"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Wadah Thumbnail Halaman (Live Dynamic Paper Size, Orientation, Rotasi & Penomoran) */}
                          <div className="flex h-44 cursor-grab items-center justify-center rounded-xl bg-slate-100/90 p-2 overflow-hidden active:cursor-grabbing">
                            <div
                              style={{
                                aspectRatio: getPageAspectRatio(item.widthPt, item.heightPt),
                              }}
                              className="relative flex h-full max-h-full max-w-full items-center justify-center overflow-hidden rounded bg-white shadow-sm ring-1 ring-slate-200/80 transition-all duration-200"
                            >
                              {/* Tag Indikator Kertas & Orientasi pada Thumbnail */}
                              <div className="pointer-events-none absolute left-1.5 top-1.5 z-20 flex flex-wrap gap-1">
                                <span className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[8px] font-bold text-white uppercase shadow-2xs backdrop-blur-xs">
                                  {standardPageSize === 'original' ? 'Asli' : standardPageSize.toUpperCase()}
                                </span>
                                <span className="rounded bg-rose-600/90 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-2xs backdrop-blur-xs">
                                  {orientation === 'landscape' ? 'Lanskap' : orientation === 'portrait' ? 'Potret' : item.widthPt > item.heightPt ? 'Lanskap' : 'Potret'}
                                </span>
                                {item.rotation > 0 && (
                                  <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-2xs backdrop-blur-xs">
                                    {item.rotation}°
                                  </span>
                                )}
                              </div>

                              {/* Gambar Thumbnail Asli */}
                              {item.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.thumbnailUrl}
                                  alt={item.name}
                                  draggable={false}
                                  style={{
                                    transform: `rotate(${item.rotation}deg) ${
                                      isQuarterTurn ? 'scale(0.78)' : ''
                                    }`,
                                  }}
                                  className="h-full w-full object-contain transition-transform duration-200"
                                />
                              ) : (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-rose-600" />
                              )}

                              {/* SIMULASI PENOMORAN HALAMAN LIVE (Mengikuti Posisi Opsi: Bawah Tengah, Bawah Kanan, Atas Kanan) */}
                              {pageNumbering !== 'none' && (
                                <div
                                  className={`pointer-events-none absolute z-20 flex items-center gap-1 rounded bg-slate-950/85 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-md ring-1 ring-white/30 backdrop-blur-xs transition-all duration-200 ${
                                    pageNumbering === 'bottom-center'
                                      ? 'bottom-1.5 left-1/2 -translate-x-1/2'
                                      : pageNumbering === 'bottom-right'
                                      ? 'bottom-1.5 right-1.5'
                                      : 'top-1.5 right-1.5'
                                  }`}
                                >
                                  <svg className="h-2.5 w-2.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                  </svg>
                                  <span>Hal {dist.startPage}</span>
                                  <span className="text-[7px] text-slate-300">/ {totalCalculatedPages}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Info Nama File & Ukuran */}
                          <div className="mt-2.5 space-y-1">
                            <div className="truncate text-xs font-bold text-slate-800" title={item.name}>
                              {item.name}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>{formatBytes(item.size)}</span>
                              <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                {item.pageCount} Hal
                              </span>
                            </div>
                          </div>

                          {/* Pemilih Rentang Halaman Kustom */}
                          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`range-mode-${item.id}`}
                                  checked={item.pageRangeMode === 'all'}
                                  onChange={() => handleToggleRangeMode(item.id, 'all')}
                                  className="h-3 w-3 text-rose-600 cursor-pointer"
                                />
                                <span className="font-semibold text-slate-700">Semua ({item.pageCount})</span>
                              </label>

                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`range-mode-${item.id}`}
                                  checked={item.pageRangeMode === 'custom'}
                                  onChange={() => handleToggleRangeMode(item.id, 'custom')}
                                  className="h-3 w-3 text-rose-600 cursor-pointer"
                                />
                                <span className="font-semibold text-slate-700">Pilih Hal</span>
                              </label>
                            </div>

                            {item.pageRangeMode === 'custom' && (
                              <div className="relative">
                                <input
                                  type="text"
                                  value={item.customPageRange}
                                  onChange={(e) => handleUpdatePageRange(item.id, e.target.value)}
                                  placeholder={`Contoh: 1-2, 4 (max ${item.pageCount})`}
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-mono font-medium text-slate-800 focus:border-rose-400 focus:bg-white focus:outline-none"
                                />
                                <div className="mt-0.5 flex justify-between text-[9px] text-slate-400 font-mono">
                                  <span>Digabung:</span>
                                  <span className="font-bold text-rose-700">
                                    {item.activePagesCount} dari {item.pageCount} Hal
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* KARTU LEMBAR PEMISAH KOSONG (JIKA OPSI addBlankSeparator AKTIF) */}
                        {dist.hasSeparator && dist.separatorPage && (
                          <div
                            key={`separator-${item.id}`}
                            className="relative flex flex-col justify-between rounded-2xl border-2 border-dashed border-amber-300/90 bg-amber-50/40 p-3.5 shadow-2xs transition-all duration-200 select-none animate-fade-in"
                          >
                            {/* Header Lembar Pemisah */}
                            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2 mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-600 text-[10px] font-black text-white shadow-2xs">
                                  +
                                </span>
                                <span className="text-[10px] font-bold text-amber-900">
                                  Lembar Pemisah Kosong
                                </span>
                              </div>
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                                Otomatis
                              </span>
                            </div>

                            {/* Wadah Simulasi Kertas Pemisah Kosong */}
                            <div className="flex h-44 items-center justify-center rounded-xl bg-amber-100/50 p-2 overflow-hidden">
                              <div
                                style={{
                                  aspectRatio: getPageAspectRatio(595, 842),
                                }}
                                className="relative flex h-full max-h-full max-w-full flex-col items-center justify-center overflow-hidden rounded bg-white shadow-sm ring-1 ring-amber-200/80 transition-all duration-200"
                              >
                                {/* Watermark Garis-garis Kertas Kosong */}
                                <div className="flex flex-col items-center justify-center gap-1 p-3 text-center">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 shadow-2xs">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <span className="text-[10px] font-bold text-amber-900 mt-1">
                                    Kertas Kosong
                                  </span>
                                  <span className="text-[9px] text-amber-700 leading-tight">
                                    Pemisah #{index + 1} & #{index + 2}
                                  </span>
                                </div>

                                {/* Simulasi Nomor Halaman jika aktif */}
                                {pageNumbering !== 'none' && (
                                  <div
                                    className={`pointer-events-none absolute z-20 flex items-center gap-1 rounded bg-slate-950/85 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-md ring-1 ring-white/30 backdrop-blur-xs transition-all duration-200 ${
                                      pageNumbering === 'bottom-center'
                                        ? 'bottom-1.5 left-1/2 -translate-x-1/2'
                                        : pageNumbering === 'bottom-right'
                                        ? 'bottom-1.5 right-1.5'
                                        : 'top-1.5 right-1.5'
                                    }`}
                                  >
                                    <span>Hal {dist.separatorPage}</span>
                                    <span className="text-[7px] text-slate-300">/ {totalCalculatedPages}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Keterangan Footer Pemisah */}
                            <div className="mt-2.5 pt-2 border-t border-amber-200/60 text-center">
                              <span className="text-[10px] font-bold text-amber-800">
                                Disisipkan pada Halaman {dist.separatorPage} dari {totalCalculatedPages}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAMPILAN 2: ALUR URUTAN HALAMAN DOKUMEN GABUNGAN (FLOW VIEW) */}
              {previewViewMode === 'flow' && (
                <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Alur Kronologis Dokumen Gabungan
                      </h4>
                      <p className="text-xs text-slate-500">
                        Simulasi urutan lembar halaman yang akan digabungkan secara berurutan
                      </p>
                    </div>
                    <span className="rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
                      Total: {totalCalculatedPages} Halaman
                    </span>
                  </div>

                  <div className="space-y-3">
                    {itemDistributions.map((dist) => (
                      <div key={`flow-${dist.item.id}`} className="space-y-3">
                        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 hover:border-slate-300 transition">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-xs font-black text-white">
                            {dist.index + 1}
                          </span>
                          <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-white shadow-2xs ring-1 ring-slate-200">
                            {dist.item.thumbnailUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={dist.item.thumbnailUrl}
                                alt={dist.item.name}
                                style={{
                                  transform: `rotate(${dist.item.rotation}deg)`,
                                }}
                                className="h-full w-full object-contain"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {dist.item.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {dist.item.pageRangeMode === 'all'
                                ? `Semua ${dist.item.pageCount} halaman`
                                : `Rentang khusus: ${dist.item.customPageRange} (${dist.count} hal)`}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="inline-block rounded-lg bg-white border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700 shadow-2xs">
                              Halaman {dist.startPage} – {dist.endPage}
                            </span>
                          </div>
                        </div>

                        {/* Indikator Lembar Pemisah dalam Alur */}
                        {dist.hasSeparator && dist.separatorPage && (
                          <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-2.5 pl-6">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-200 text-amber-800 text-xs font-bold">
                              📄
                            </div>
                            <div className="flex-1 text-xs font-bold text-amber-900">
                              1 Lembar Pemisah Kosong
                            </div>
                            <span className="rounded-lg bg-white border border-amber-300 px-2 py-0.5 text-xs font-bold text-amber-800 shadow-2xs">
                              Halaman {dist.separatorPage}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Kolom Kanan: Pengaturan Penggabungan & Tombol Aksi (lg:col-span-4) */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-6 sticky top-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Opsi Gabung Dokumen
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesuaikan ukuran kertas, orientasi, penomoran, dan nama file
                  </p>
                </div>

                {/* 1. Penyeragaman Ukuran Kertas */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ukuran Kertas Dokumen
                  </label>
                  <select
                    value={standardPageSize}
                    onChange={(e) => setStandardPageSize(e.target.value as MergeStandardPageSize)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold text-slate-800 transition focus:border-rose-500 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    {(Object.keys(MERGE_PAGE_SIZES) as MergeStandardPageSize[]).map((key) => (
                      <option key={key} value={key}>
                        {MERGE_PAGE_SIZES[key].label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    {MERGE_PAGE_SIZES[standardPageSize].desc}
                  </p>
                </div>

                {/* 2. Orientasi Halaman */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Orientasi Halaman
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(MERGE_ORIENTATIONS) as MergeOrientation[]).map((key) => {
                      const item = MERGE_ORIENTATIONS[key];
                      const isSelected = orientation === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setOrientation(key)}
                          className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center text-xs font-semibold transition cursor-pointer select-none ${
                            isSelected
                              ? 'border-rose-600 bg-rose-50 text-rose-950 font-bold ring-2 ring-rose-500/25 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            {isSelected && (
                              <svg className="h-3 w-3 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            <span>{key === 'keep' ? 'Asli' : key === 'portrait' ? 'Potret' : 'Lanskap'}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {MERGE_ORIENTATIONS[orientation].desc}
                  </p>
                </div>

                {/* 3. Penomoran Halaman Baru */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Penomoran Halaman Baru
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(MERGE_PAGE_NUMBERINGS) as MergePageNumbering[]).map((key) => {
                      const item = MERGE_PAGE_NUMBERINGS[key];
                      const isSelected = pageNumbering === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPageNumbering(key)}
                          className={`rounded-xl border p-2 text-left transition select-none cursor-pointer ${
                            isSelected
                              ? 'border-rose-600 bg-rose-50 font-bold text-rose-950 ring-2 ring-rose-500/25 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{item.tag}</span>
                            {isSelected && (
                              <svg className="h-3 w-3 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">{item.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Pemisah Dokumen */}
                <div
                  className={`rounded-2xl border p-3.5 transition-colors duration-200 ${
                    addBlankSeparator
                      ? 'border-rose-300 bg-rose-50/80 text-rose-950 ring-1 ring-rose-500/20'
                      : 'border-slate-200 bg-slate-50/60 text-slate-700'
                  }`}
                >
                  <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addBlankSeparator}
                      onChange={(e) => setAddBlankSeparator(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <span>Sisipkan 1 Lembar Pemisah Kosong Antar File PDF</span>
                  </label>
                  {addBlankSeparator && (
                    <p className="mt-1 text-[10px] text-rose-700 pl-6">
                      Menambahkan {items.length - 1} lembar kosong di sela dokumen secara otomatis.
                    </p>
                  )}
                </div>

                {/* 5. Nama File Output */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nama File PDF Gabungan
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="dokumen-gabungan"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-12 text-xs font-semibold text-slate-800 transition focus:border-rose-500 focus:bg-white focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-xs font-bold text-rose-700">
                      .pdf
                    </span>
                  </div>
                </div>

                {/* Indikator Progres Penggabungan */}
                {isMerging && progress && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                      <span>Menggabungkan Dokumen {progress.current} dari {progress.total}...</span>
                      <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-rose-200">
                      <div
                        className="h-full bg-rose-600 transition-all duration-200"
                        style={{
                          width: `${(progress.current / progress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Pesan Kesalahan Penggabungan */}
                {mergeError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                    <span className="font-bold">Gagal: </span>
                    {mergeError}
                  </div>
                )}

                {/* Tombol CTA Utama (Crimson Red Menonjol & Jelas) */}
                <button
                  type="button"
                  onClick={handleStartMerge}
                  disabled={isMerging || items.length < 2}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all duration-200 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isMerging ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Menggabungkan {items.length} PDF...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                      <span>
                        Gabungkan {items.length} File PDF ({totalCalculatedPages} Hal)
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

        {/* HASIL PENGGABUNGAN SELESAI */}
        {result && resultUrl && (
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
                      Penggabungan Berhasil
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
                  <span>Unduh File PDF Gabungan</span>
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

            {/* Statistik Hasil Penggabungan */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Jumlah File Digabung</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {result.totalMergedFiles} Dokumen
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Total Halaman Akhir</div>
                <div className="text-2xl font-black text-rose-700 mt-1">
                  {result.totalMergedPages} Halaman
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Ukuran Kertas</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {standardPageSize === 'original' ? 'Asli' : standardPageSize.toUpperCase()}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Ukuran File</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {formatBytes(result.sizeBytes)}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* LIGHTBOX MODAL */}
      {lightboxItem && (
        <div
          onClick={() => setLightboxItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] max-w-4xl flex-col items-center overflow-hidden rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex w-full items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Pratinjau Sampul: {lightboxItem.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {formatBytes(lightboxItem.size)} • {lightboxItem.pageCount} Halaman Total
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex max-h-[72vh] items-center justify-center overflow-auto rounded-xl bg-slate-50 p-2">
              {lightboxItem.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightboxItem.thumbnailUrl}
                  alt={lightboxItem.name}
                  style={{
                    transform: `rotate(${lightboxItem.rotation}deg)`,
                  }}
                  className="max-h-[66vh] w-auto rounded-lg shadow-md object-contain transition-transform duration-200"
                />
              )}
            </div>

            <div className="mt-4 flex w-full items-center justify-between">
              <button
                type="button"
                onClick={() => handleRotateItem(lightboxItem.id)}
                className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Putar 90° ({lightboxItem.rotation}°)</span>
              </button>

              <button
                type="button"
                onClick={() => setLightboxItem(null)}
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
