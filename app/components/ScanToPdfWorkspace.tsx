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
  applyScanFilterToCanvas,
  compileScanPagesToPdf,
  formatBytes,
  GeneratedScanPdfResult,
  processImageFileToScanItem,
  SCAN_FILTERS,
  SCAN_MARGINS,
  SCAN_PAGE_SIZES,
  ScanFilterType,
  ScanMargin,
  ScanOrientation,
  ScanPageItem,
  ScanPageSize,
} from '@/app/lib/scan-to-pdf';
import { Navbar } from './Navbar';

export function ScanToPdfWorkspace() {
  // Lembar-lembar hasil pindai
  const [pages, setPages] = useState<ScanPageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('');

  // Mode & Kamera
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Pengaturan Output
  const [globalFilter, setGlobalFilter] = useState<ScanFilterType>('magic-color');
  const [pageSize, setPageSize] = useState<ScanPageSize>('a4');
  const [orientation, setOrientation] = useState<ScanOrientation>('auto');
  const [margin, setMargin] = useState<ScanMargin>('none');
  const [outputName, setOutputName] = useState<string>('dokumen-pindai-scorpio');

  // Status Pemrosesan & Hasil
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<{ current: number; total: number; message: string } | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedScanPdfResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Drag & Drop File Upload
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Drag & Drop Reordering Halaman
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Modal Zoom Pratinjau
  const [activeZoomIndex, setActiveZoomIndex] = useState<number | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const activeResultUrlRef = useRef<string | null>(null);

  // Bersihkan URL saat unmount
  useEffect(() => {
    return () => {
      if (activeResultUrlRef.current) {
        URL.revokeObjectURL(activeResultUrlRef.current);
        activeResultUrlRef.current = null;
      }
      stopCamera();
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

  // Hentikan Stream Kamera
  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Mulai Kamera
  const startCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    setCameraError(null);
    stopCamera();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Peramban Anda tidak mendukung akses kamera perangkat.');
      return;
    }

    try {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {
        // Abaikan jika ditolak
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      // Fallback ke video default
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStreamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr) {
        setCameraError(
          fallbackErr instanceof Error
            ? `Izin kamera ditolak atau tidak tersedia: ${fallbackErr.message}`
            : 'Gagal mengakses kamera. Pastikan izin kamera telah diberikan pada browser.'
        );
      }
    }
  };

  // Buka Modal Kamera
  const handleOpenCameraModal = () => {
    setIsCameraActive(true);
    setTimeout(() => {
      void startCamera(cameraFacing);
    }, 100);
  };

  // Tutup Modal Kamera
  const handleCloseCameraModal = () => {
    stopCamera();
    setIsCameraActive(false);
    setCameraError(null);
  };

  // Balik Kamera (Depan / Belakang)
  const handleToggleCameraFacing = () => {
    const next = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(next);
    void startCamera(next);
  };

  // Tangkap Lembar dari Kamera (Snap)
  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const newItem = await processImageFileToScanItem(blob, globalFilter);
        setPages((prev) => [...prev, newItem]);
        clearResult();
      } catch (e) {
        console.error('Gagal memproses frame kamera:', e);
      }
    }, 'image/jpeg', 0.95);
  };

  // Pemrosesan File Gambar yang Dipilih/Ditarik
  const handleAddImageFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/i.test(f.name)
    );

    if (fileArray.length === 0) {
      alert('Pilih berkas foto atau gambar yang valid (JPG, PNG, WebP, BMP).');
      return;
    }

    setIsLoadingImages(true);
    clearResult();

    try {
      const newItems: ScanPageItem[] = [];
      for (let i = 0; i < fileArray.length; i++) {
        setLoadingText(`Memproses foto ${i + 1} dari ${fileArray.length}...`);
        const item = await processImageFileToScanItem(fileArray[i], globalFilter);
        newItems.push(item);
      }
      setPages((prev) => [...prev, ...newItems]);
    } catch (err) {
      alert('Terjadi kesalahan saat memproses gambar. Pastikan gambar tidak rusak.');
      console.error(err);
    } finally {
      setIsLoadingImages(false);
      setLoadingText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (addMoreInputRef.current) addMoreInputRef.current.value = '';
    }
  };

  // Dukungan Ctrl + V (Paste Gambar dari Clipboard)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      const images = Array.from(e.clipboardData.files).filter(
        (f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/i.test(f.name)
      );
      if (images.length > 0) {
        e.preventDefault();
        void handleAddImageFiles(images);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [globalFilter]);

  // Drag & Drop Berkas
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
      void handleAddImageFiles(e.dataTransfer.files);
    }
  };

  // Ubah Filter Satu Halaman
  const handleChangePageFilter = async (pageId: string, newFilter: ScanFilterType) => {
    setPages((prev) =>
      prev.map((item) => {
        if (item.id !== pageId) return item;

        const img = new Image();
        img.src = item.originalDataUrl;

        const canvas = document.createElement('canvas');
        canvas.width = item.width;
        canvas.height = item.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }

        const newFilteredUrl = applyScanFilterToCanvas(canvas, newFilter);

        return {
          ...item,
          filter: newFilter,
          filteredDataUrl: newFilteredUrl,
        };
      })
    );
    clearResult();
  };

  // Terapkan Filter Massal ke Seluruh Halaman
  const handleApplyGlobalFilter = (targetFilter: ScanFilterType) => {
    setGlobalFilter(targetFilter);
    setPages((prev) =>
      prev.map((item) => {
        const img = new Image();
        img.src = item.originalDataUrl;

        const canvas = document.createElement('canvas');
        canvas.width = item.width;
        canvas.height = item.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }

        const newFilteredUrl = applyScanFilterToCanvas(canvas, targetFilter);

        return {
          ...item,
          filter: targetFilter,
          filteredDataUrl: newFilteredUrl,
        };
      })
    );
    clearResult();
  };

  // Putar Halaman 90 Derajat
  const handleRotatePage = (index: number) => {
    setPages((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        rotation: (copy[index].rotation + 90) % 360,
      };
      return copy;
    });
    clearResult();
  };

  // Putar Seluruh Lembar Sekaligus
  const handleRotateAll = () => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + 90) % 360,
      }))
    );
    clearResult();
  };

  // Geser Halaman Kiri / Kanan
  const handleMovePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return;
    setPages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
    clearResult();
  };

  // Hapus Halaman Tertentu
  const handleDeletePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
    clearResult();
  };

  // Balik Urutan Lembar
  const handleReversePages = () => {
    setPages((prev) => [...prev].reverse());
    clearResult();
  };

  // Reset Semua Lembar
  const handleResetAll = () => {
    if (pages.length > 0 && !confirm('Apakah Anda yakin ingin menghapus seluruh lembar pindai saat ini?')) {
      return;
    }
    setPages([]);
    clearResult();
    setProcessError(null);
    stopCamera();
    setIsCameraActive(false);
  };

  // Drag and Drop Grid Sorting
  const handleCardDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(index);
  };

  const handleCardDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleCardDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    const sourceIdxStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = parseInt(sourceIdxStr, 10);
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    handleMovePage(sourceIndex, targetIndex);
  };

  const handleCardDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Eksekusi Pembuatan PDF
  const handleGeneratePdf = async () => {
    if (pages.length === 0) {
      alert('Pindai atau tambahkan minimal 1 lembar foto dokumen terlebih dahulu.');
      return;
    }

    setIsProcessing(true);
    setProcessError(null);
    clearResult();

    try {
      const generated = await compileScanPagesToPdf(
        pages,
        {
          pageSize,
          orientation,
          margin,
          outputName: outputName.trim() || 'dokumen-pindai-scorpio',
        },
        (current, total, message) => {
          setProcessStatus({ current, total, message });
        }
      );

      const url = URL.createObjectURL(generated.blob);
      activeResultUrlRef.current = url;
      setResultUrl(url);
      setResult(generated);
    } catch (err) {
      console.error(err);
      setProcessError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menyusun dokumen PDF. Silakan coba kembali.'
      );
    } finally {
      setIsProcessing(false);
      setProcessStatus(null);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col bg-[#F8F9FC] text-slate-900"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="bg-dot-grid pointer-events-none fixed inset-0 z-0 opacity-75"
        aria-hidden="true"
      />

      <Navbar />

      {/* OVERLAY DRAG & DROP FILE */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-rose-950/80 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-rose-500 pointer-events-none transition-all animate-in fade-in">
          <div className="w-24 h-24 rounded-3xl bg-rose-600/30 flex items-center justify-center text-5xl mb-4 border border-rose-500/50 shadow-2xl">
            📷
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-white">Lepaskan Foto Dokumen di Sini</h3>
          <p className="text-rose-200 mt-2 text-sm md:text-base font-medium">
            Berkas foto akan otomatis ditambahkan ke daftar lembar pindai
          </p>
        </div>
      )}

      {/* Input File Tersembunyi */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/bmp"
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.files) void handleAddImageFiles(e.target.files);
        }}
      />
      <input
        ref={addMoreInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/bmp"
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.files) void handleAddImageFiles(e.target.files);
        }}
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
            <span className="font-bold text-slate-900">Pindai ke PDF</span>
          </div>

          {pages.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-2xs border border-slate-200">
                <span className="text-rose-600 font-extrabold">📸</span>
                <span>{pages.length} Lembar Terkumpul</span>
              </span>
              <button
                type="button"
                onClick={handleOpenCameraModal}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                + Kamera
              </button>
              <button
                type="button"
                onClick={handleResetAll}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-2xs transition hover:bg-rose-100 cursor-pointer"
              >
                Bersihkan
              </button>
            </div>
          )}
        </div>

        {/* Hero Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/90 bg-orange-50/80 px-3.5 py-1 text-xs font-bold text-orange-800 uppercase tracking-wider shadow-2xs">
            <svg className="h-3.5 w-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            CAMSCANNER BROWSER • Pindai Kamera &amp; Foto Digital
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">
            Pindai ke PDF <span className="text-orange-600">(CamScanner Online)</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Ambil foto berkas fisik via kamera atau unggah foto dokumen Anda. Filter cerdas kami memutihkan latar kertas, membersihkan bayangan, dan mempertajam teks menjadi PDF resmi siap cetak (A4, F4, Letter).
          </p>
        </div>

        {/* Notifikasi Pesan Kesalahan */}
        {processError && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 sm:text-sm shadow-xs">
            <div className="flex-1 font-medium">{processError}</div>
            <button
              onClick={() => setProcessError(null)}
              className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 1: BELUM ADA LEMBAR (DROPZONE BERSIH TANPA PREVIEW DUMMY) */}
        {/* ========================================================================================= */}
        {pages.length === 0 && !isLoadingImages && (
          <div className="mx-auto w-full max-w-3xl space-y-8 animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`group relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-300 ${
                isDraggingFile
                  ? 'border-orange-500 bg-orange-50/70 shadow-2xl scale-[1.01]'
                  : 'border-slate-300/80 bg-white/95 shadow-xl shadow-slate-200/50 hover:border-orange-400 hover:bg-white hover:shadow-2xl'
              }`}
            >
              {/* Visual Icon */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-500/30 transition-transform duration-300 group-hover:scale-110">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md border-2 border-white">
                  <span className="text-[10px] font-black font-mono">SCN</span>
                </div>
              </div>

              <p className="font-display text-lg sm:text-xl font-black text-slate-900">
                Pindai Lembar Dokumen Baru Anda
              </p>
              <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">
                Gunakan kamera langsung dari laptop / ponsel Anda atau pilih koleksi foto dokumen dari memori perangkat. Anda juga dapat menempel gambar langsung dengan <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 border border-slate-300">Ctrl + V</kbd>.
              </p>

              {/* Dua Tombol Aksi Utama */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
                <button
                  type="button"
                  onClick={handleOpenCameraModal}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 px-6 shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all cursor-pointer text-sm"
                >
                  <span className="text-lg">📷</span>
                  <span>Buka Kamera Pindai</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-6 shadow-sm transition-all cursor-pointer text-sm"
                >
                  <span className="text-lg">🖼️</span>
                  <span>Pilih Foto dari Berkas</span>
                </button>
              </div>

              {/* Keunggulan Fitur */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="text-orange-500 font-bold">✓</span>
                  <span>Mendukung JPG, PNG, WebP &amp; BMP</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-orange-500 font-bold">✓</span>
                  <span>Filter Pemutih Kertas Otomatis</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-orange-500 font-bold">✓</span>
                  <span>100% Client-Side Tanpa Server</span>
                </div>
              </div>
            </div>

            {/* 3 Kartu Fitur Keunggulan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center text-xl mb-3 font-bold">
                  ✨
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Warna Tajam (Magic Color)</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Menghilangkan kusam kertas kuning/abu-abu dan menonjolkan warna stempel, logo instansi, serta tanda tangan basah.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center text-xl mb-3 font-bold">
                  📄
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Hitam-Putih Bersih (B&amp;W)</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Algoritma binarisasi cerdas yang memutihkan kertas 100% dan membuat teks tajam pekat tanpa bayangan lipatan.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center text-xl mb-3 font-bold">
                  📐
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Standar A4, F4 &amp; Folio</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Format otomatis ke lembar A4 CPNS atau F4/Folio kedinasan dengan rasio gambar tetap proporsional dan tidak gepeng.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Saat Proses Gambar */}
        {isLoadingImages && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-orange-600 border-t-transparent mb-4" />
            <h3 className="text-base font-bold text-slate-800">{loadingText || 'Memproses foto dokumen...'}</h3>
            <p className="text-xs text-slate-400 mt-1">Menerapkan filter dokumen dan menyiapkan kanvas...</p>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 2: WORKSPACE LEMBAR SCAN (MINIMAL 1 LEMBAR SUDAH ADA) */}
        {/* ========================================================================================= */}
        {pages.length > 0 && (
          <div className="space-y-6">
            {/* Top Bar Workspace */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center text-2xl font-black">
                  {pages.length}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>{pages.length} Lembar Dokumen Siap Disusun</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tarik kartu untuk menyusun urutan, klik putar, atau sesuaikan filter per lembar dokumen.
                  </p>
                </div>
              </div>

              {/* Tombol Aksi Top Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenCameraModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <span>📷</span> Ambil Kamera
                </button>
                <button
                  type="button"
                  onClick={() => addMoreInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <span>➕</span> Tambah File
                </button>
                <button
                  type="button"
                  onClick={handleRotateAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs cursor-pointer"
                  title="Putar semua lembar 90 derajat searah jarum jam"
                >
                  <span>↻</span> Putar Semua
                </button>
                <button
                  type="button"
                  onClick={handleReversePages}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs cursor-pointer"
                  title="Balik urutan lembar halaman"
                >
                  <span>⇄</span> Balik Urutan
                </button>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-all shadow-2xs cursor-pointer"
                >
                  <span>🗑️</span> Bersihkan
                </button>
              </div>
            </div>

            {/* Filter Massal Banner */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-800">Terapkan Filter ke Seluruh Lembar:</span>
                <span className="text-xs text-slate-400 hidden sm:inline">(Klik salah satu untuk mengubah semuanya sekaligus)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(SCAN_FILTERS) as ScanFilterType[]).map((fKey) => {
                  const f = SCAN_FILTERS[fKey];
                  const isActive = globalFilter === fKey;
                  return (
                    <button
                      key={fKey}
                      type="button"
                      onClick={() => handleApplyGlobalFilter(fKey)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-rose-600 text-white shadow-md'
                          : 'border border-slate-200 bg-slate-50 hover:bg-white text-slate-700'
                      }`}
                    >
                      <span>{f.icon}</span>
                      <span>{f.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid Kartu Lembar Hasil Pindai */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pages.map((page, index) => {
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={page.id}
                    draggable
                    onDragStart={(e) => handleCardDragStart(e, index)}
                    onDragOver={(e) => handleCardDragOver(e, index)}
                    onDrop={(e) => handleCardDrop(e, index)}
                    onDragEnd={handleCardDragEnd}
                    className={`relative rounded-2xl bg-white border transition-all flex flex-col overflow-hidden group shadow-sm hover:shadow-md ${
                      isDragging ? 'opacity-40 scale-95 border-rose-500' : 'opacity-100'
                    } ${
                      isDragOver ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-slate-200/80'
                    }`}
                  >
                    {/* Top Header Kartu */}
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-800 font-bold text-xs flex items-center justify-center border border-orange-200">
                          {index + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          Lembar {index + 1}
                        </span>
                      </div>

                      {/* Badge Filter & Rotasi */}
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {page.rotation > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                            {page.rotation}°
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shadow-2xs">
                          {SCAN_FILTERS[page.filter].icon} {SCAN_FILTERS[page.filter].name.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    {/* Pratinjau Gambar */}
                    <div
                      className="relative h-60 bg-slate-100/60 flex items-center justify-center p-3 cursor-pointer overflow-hidden"
                      onClick={() => setActiveZoomIndex(index)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={page.filteredDataUrl}
                        alt={`Lembar ${index + 1}`}
                        className="max-h-full max-w-full object-contain rounded-lg shadow-sm transition-transform duration-200"
                        style={{
                          transform: `rotate(${page.rotation}deg)`,
                        }}
                      />

                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                        <span className="px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-lg flex items-center gap-1.5">
                          <span>🔍</span> Perbesar Lembar
                        </span>
                      </div>
                    </div>

                    {/* Kontrol Edit Per Kartu */}
                    <div className="p-3 bg-white border-t border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="text-slate-500 font-medium">Filter:</span>
                        <select
                          value={page.filter}
                          onChange={(e) => void handleChangePageFilter(page.id, e.target.value as ScanFilterType)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                        >
                          <option value="magic-color">✨ Warna Tajam</option>
                          <option value="magic-bw">📄 Hitam-Putih Bersih</option>
                          <option value="grayscale">🔘 Skala Abu-Abu</option>
                          <option value="original">📷 Foto Asli</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRotatePage(index)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                          title="Putar 90 derajat searah jarum jam"
                        >
                          <span>↻</span>
                          <span className="text-[10px] font-normal">Putar</span>
                        </button>

                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMovePage(index, index - 1)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-700 border border-slate-200 text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                          title="Pindahkan lembar ke kiri"
                        >
                          <span>←</span>
                          <span className="text-[10px] font-normal">Maju</span>
                        </button>

                        <button
                          type="button"
                          disabled={index === pages.length - 1}
                          onClick={() => handleMovePage(index, index + 1)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-700 border border-slate-200 text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                          title="Pindahkan lembar ke kanan"
                        >
                          <span>→</span>
                          <span className="text-[10px] font-normal">Mundur</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePage(index)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                          title="Hapus lembar ini"
                        >
                          <span>🗑️</span>
                          <span className="text-[10px] font-normal">Hapus</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Panel Pengaturan Dokumen & Tombol CTA */}
            <div className="mt-8 p-6 sm:p-8 rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 space-y-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="text-orange-600">⚙️</span> Pengaturan Format Dokumen PDF Akhir
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Ukuran Kertas</span>
                    <span className="text-[11px] text-orange-600 font-normal">Rekomendasi A4</span>
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(e.target.value as ScanPageSize);
                      clearResult();
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                  >
                    <option value="a4">A4 (210 × 297 mm) — Standar CPNS / Resmi</option>
                    <option value="f4">F4 / Folio (215 × 330 mm) — Kedinasan RI</option>
                    <option value="letter">US Letter (216 × 279 mm)</option>
                    <option value="fit">Sesuaikan Ukuran Foto (Auto Fit)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Orientasi Halaman</label>
                  <select
                    value={orientation}
                    onChange={(e) => {
                      setOrientation(e.target.value as ScanOrientation);
                      clearResult();
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                  >
                    <option value="auto">Auto (Deteksi Otomatis Tiap Lembar)</option>
                    <option value="portrait">Tegak (Portrait)</option>
                    <option value="landscape">Mendatar (Landscape)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Margin / Batas Tepi</label>
                  <select
                    value={margin}
                    onChange={(e) => {
                      setMargin(e.target.value as ScanMargin);
                      clearResult();
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                  >
                    <option value="none">Tanpa Margin (Foto Penuh ke Tepi)</option>
                    <option value="narrow">Sempit (12 pt — Rapi)</option>
                    <option value="normal">Normal (28 pt — Bingkai Cetak)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nama Berkas PDF</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="dokumen-pindai-scorpio"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-12 font-medium"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono pointer-events-none">
                      .pdf
                    </span>
                  </div>
                </div>
              </div>

              {/* Indikator Status Proses */}
              {isProcessing && processStatus && (
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-orange-900">
                    <span>{processStatus.message}</span>
                    <span>
                      Langkah {processStatus.current} dari {processStatus.total}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-orange-100 overflow-hidden">
                    <div
                      className="h-full bg-orange-600 transition-all duration-300"
                      style={{
                        width: `${(processStatus.current / processStatus.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Tombol CTA Utama */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isProcessing || pages.length === 0}
                  onClick={handleGeneratePdf}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-bold py-4 px-8 rounded-2xl shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all text-sm cursor-pointer"
                >
                  <span className="text-lg">📄</span>
                  <span>
                    {isProcessing ? 'Menyusun Dokumen PDF...' : `Simpan & Buat PDF Sekarang (${pages.length} Lembar)`}
                  </span>
                </button>
              </div>
            </div>

            {/* Hasil Eksekusi (Result Card) */}
            {result && resultUrl && (
              <div className="p-6 sm:p-8 rounded-3xl border-2 border-emerald-500/40 bg-white shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-3xl shadow-xs font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mb-1">
                        Dokumen PDF Berhasil Dibuat
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                        {result.fileName}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        Ukuran: <strong className="text-slate-800">{formatBytes(result.sizeBytes)}</strong> • Jumlah: <strong className="text-slate-800">{result.pageCount} Halaman</strong> • Standar: <strong className="text-slate-800">{SCAN_PAGE_SIZES[result.pageSize].label.split(' ')[0]}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                  <a
                    href={resultUrl}
                    download={result.fileName}
                    className="inline-flex items-center justify-center gap-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all text-sm cursor-pointer"
                  >
                    <span>⬇️</span>
                    Unduh Berkas PDF Sekarang
                  </a>

                  <a
                    href={resultUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-bold py-3.5 px-5 rounded-2xl shadow-2xs transition-all text-sm cursor-pointer"
                  >
                    <span>👀</span>
                    Buka Pratinjau di Tab Baru
                  </a>

                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="inline-flex items-center justify-center gap-2.5 bg-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-700 font-semibold py-3.5 px-5 rounded-2xl border border-slate-200 transition-all text-sm cursor-pointer"
                  >
                    <span>🔄</span>
                    Pindai Dokumen Baru
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Kamera Pemindai Langsung */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
              <h3 className="text-white font-bold text-base sm:text-lg">
                Kamera Pindai Dokumen
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={handleToggleCameraFacing}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>🔄</span>
                  <span className="hidden sm:inline">Balik Kamera</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCloseCameraModal}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white flex items-center justify-center font-bold text-sm border border-slate-700 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="relative w-full max-w-3xl flex-1 max-h-[68vh] rounded-3xl overflow-hidden bg-black flex items-center justify-center my-4 border border-slate-800 shadow-2xl">
            {cameraError ? (
              <div className="p-6 text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-red-950/60 text-red-400 border border-red-800 flex items-center justify-center text-3xl mx-auto mb-4">
                  📷
                </div>
                <h4 className="text-white font-bold text-lg mb-2">Akses Kamera Bermasalah</h4>
                <p className="text-xs text-slate-400 mb-6">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => void startCamera(cameraFacing)}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg transition-all"
                >
                  Coba Akses Lagi
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover sm:object-contain"
                />

                {isFlashing && (
                  <div className="absolute inset-0 bg-white/90 z-20 pointer-events-none animate-out fade-out duration-200"></div>
                )}

                <div className="absolute inset-4 sm:inset-10 border-2 border-dashed border-rose-500/70 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
                  <div className="flex justify-between items-start text-[11px] font-mono text-rose-400 font-bold bg-black/60 px-3 py-1 rounded-lg backdrop-blur-sm self-center">
                    Posisikan berkas kertas di dalam bingkai ini
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                    <span>A4 / FOLIO RATIO</span>
                    <span>HD SENSOR</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="w-full max-w-3xl flex items-center justify-between gap-4">
            <div className="text-xs text-slate-300">
              Terkumpul: <strong className="text-rose-400 font-bold">{pages.length} Lembar</strong>
            </div>

            <button
              type="button"
              disabled={!!cameraError}
              onClick={handleCapturePhoto}
              className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-white/80 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(225,29,72,0.6)] transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              title="Jepret Foto Lembar Ini"
            >
              📸
            </button>

            <button
              type="button"
              onClick={handleCloseCameraModal}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 shadow-md transition-all cursor-pointer"
            >
              Selesai ({pages.length})
            </button>
          </div>
        </div>
      )}

      {/* Modal Zoom Lembar */}
      {activeZoomIndex !== null && pages[activeZoomIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setActiveZoomIndex(null)}
        >
          <div
            className="w-full max-w-4xl flex items-center justify-between gap-4 mb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-rose-600 text-white font-black text-sm flex items-center justify-center">
                {activeZoomIndex + 1}
              </span>
              <div>
                <h4 className="text-white font-bold text-base">
                  Pratinjau Lembar {activeZoomIndex + 1}
                </h4>
                <p className="text-xs text-slate-400">
                  {pages[activeZoomIndex].width} × {pages[activeZoomIndex].height} px • Filter: {SCAN_FILTERS[pages[activeZoomIndex].filter].name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRotatePage(activeZoomIndex)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              >
                ↻ Putar 90°
              </button>
              <button
                type="button"
                onClick={() => setActiveZoomIndex(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-xs border border-slate-700 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          <div
            className="flex-1 max-h-[80vh] w-full max-w-4xl flex items-center justify-center p-2 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pages[activeZoomIndex].filteredDataUrl}
              alt={`Lembar ${activeZoomIndex + 1} Resolusi Penuh`}
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-200"
              style={{
                transform: `rotate(${pages[activeZoomIndex].rotation}deg)`,
              }}
            />
          </div>

          <div
            className="w-full max-w-4xl flex items-center justify-between gap-4 mt-2 text-xs text-slate-400"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={activeZoomIndex === 0}
              onClick={() => setActiveZoomIndex(activeZoomIndex - 1)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-white font-bold transition-all cursor-pointer"
            >
              ← Lembar Sebelumnya
            </button>
            <span>Klik di luar gambar untuk menutup</span>
            <button
              type="button"
              disabled={activeZoomIndex === pages.length - 1}
              onClick={() => setActiveZoomIndex(activeZoomIndex + 1)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-white font-bold transition-all cursor-pointer"
            >
              Lembar Berikutnya →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
