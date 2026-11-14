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
  sanitizePdfFilename,
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
      // Deteksi ketersediaan multi kamera
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {
        // Abaikan jika enumerateDevices dibatasi
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
    } catch (err) {
      console.warn('Gagal membuka kamera dengan facing ideal:', err);
      // Fallback ke kamera default apa pun yang ada
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

    // Flash animasi
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Gambar frame video
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

        // Buat canvas dan aplikasikan filter baru dari originalDataUrl
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
      className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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

      {/* HEADER UTAMA */}
      <header className="relative border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span>📸</span> Scanner Dokumen Kamera & Foto Digital
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                Pindai ke PDF <span className="text-rose-500">(CamScanner Browser)</span>
              </h1>
              <p className="text-slate-400 text-sm sm:text-base mt-1 max-w-2xl">
                Ambil foto berkas fisik via kamera atau unggah foto dokumen Anda. Filter cerdas kami membersihkan bayangan, memutihkan kertas, dan mempertajam teks menjadi PDF resmi siap cetak.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                100% Client-Side Tanpa Server
              </span>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-700/60"
              >
                ← Beranda
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAMPILAN AWAL KOSONG (DROPZONE & CAMERA LAUNCHER) */}
        {pages.length === 0 && !isLoadingImages && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-200">
            {/* KARTU DROPZONE BESAR */}
            <div className="relative rounded-3xl border-2 border-dashed border-slate-700/80 hover:border-rose-500/60 bg-slate-900/60 hover:bg-slate-900/90 transition-all p-8 sm:p-12 text-center group shadow-xl">
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

              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-rose-600/30 to-rose-400/20 flex items-center justify-center text-4xl sm:text-5xl border border-rose-500/40 group-hover:scale-105 transition-all shadow-lg">
                    📄
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center text-xl shadow-lg border-2 border-slate-900">
                    📸
                  </div>
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Pindai Lembar Dokumen Baru Anda
              </h2>
              <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto mb-8">
                Gunakan kamera langsung dari laptop / ponsel Anda atau pilih koleksi foto dokumen dari memori perangkat.
              </p>

              {/* DUA TOMBOL AKSI UTAMA */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={handleOpenCameraModal}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-sm shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all cursor-pointer"
                >
                  <span className="text-xl">📷</span>
                  Buka Kamera Pindai
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-slate-800 hover:bg-slate-750 hover:border-slate-600 active:scale-[0.99] text-white font-bold text-sm border border-slate-700 transition-all cursor-pointer"
                >
                  <span className="text-xl">🖼️</span>
                  Pilih Foto dari Berkas
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-rose-400">✓</span> Mendukung JPG, PNG, WebP & BMP
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-rose-400">✓</span> Bisa Tempel Clipboard (<kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">Ctrl + V</kbd>)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-rose-400">✓</span> Multi-lembar Otomatis
                </span>
              </div>
            </div>

            {/* KARTU FITUR KEUNGGULAN SCANNER */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xl mb-3">
                  ✨
                </div>
                <h4 className="font-bold text-white text-sm">Warna Tajam (Magic Color)</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Menghilangkan kusam kertas kuning/abu-abu dan menonjolkan warna stempel, logo instansi, serta tanda tangan basah.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xl mb-3">
                  📄
                </div>
                <h4 className="font-bold text-white text-sm">Hitam-Putih Bersih (B&W)</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Algoritma binarisasi cerdas yang memutihkan kertas 100% dan membuat teks tajam pekat tanpa bayangan lipatan.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl mb-3">
                  📐
                </div>
                <h4 className="font-bold text-white text-sm">Standar A4, F4 & Folio</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Format otomatis ke lembar A4 CPNS atau F4/Folio kedinasan dengan rasio gambar tetap proporsional dan tidak gepeng.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* LOADING SAAT PROSES GAMBAR */}
        {isLoadingImages && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full border-4 border-rose-500/20 border-t-rose-500 animate-spin mb-4"></div>
            <h3 className="text-lg font-bold text-white">{loadingText || 'Memproses foto dokumen...'}</h3>
            <p className="text-xs text-slate-400 mt-1">Menerapkan filter dokumen dan menyiapkan kanvas...</p>
          </div>
        )}

        {/* WORKSPACE LEMBAR SCAN (JIKA MINIMAL 1 LEMBAR SUDAH ADA) */}
        {pages.length > 0 && (
          <div className="space-y-6">
            {/* HIDDEN INPUT UNTUK TAMBAH FOTO LAGI */}
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

            {/* TOP BAR WORKSPACE */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center text-2xl font-black">
                  {pages.length}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>{pages.length} Lembar Dokumen Siap Diproses</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tarik kartu untuk menyusun urutan, klik putar, atau ubah filter per lembar dokumen.
                  </p>
                </div>
              </div>

              {/* ACTION BUTTONS DI HEADER WORKSPACE */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenCameraModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <span>📷</span> Ambil Foto Kamera
                </button>
                <button
                  type="button"
                  onClick={() => addMoreInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                >
                  <span>➕</span> Tambah dari File
                </button>
                <button
                  type="button"
                  onClick={handleRotateAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/80 cursor-pointer"
                  title="Putar semua lembar 90 derajat searah jarum jam"
                >
                  <span>↻</span> Putar Semua
                </button>
                <button
                  type="button"
                  onClick={handleReversePages}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/80 cursor-pointer"
                  title="Balik urutan lembar halaman"
                >
                  <span>⇄</span> Balik Urutan
                </button>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white text-xs font-medium border border-rose-800/40 transition-all cursor-pointer"
                >
                  <span>🗑️</span> Bersihkan
                </button>
              </div>
            </div>

            {/* FILTER MASSAL BANNER */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-200">Terapkan Filter ke Seluruh Lembar:</span>
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
                          : 'bg-slate-800/90 hover:bg-slate-750 text-slate-300 border border-slate-700/60'
                      }`}
                    >
                      <span>{f.icon}</span>
                      <span>{f.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GRID KARTU LEMBAR HASIL PINDAI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pages.map((page, index) => {
                const isRotated90or270 = page.rotation === 90 || page.rotation === 270;
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
                    className={`relative rounded-2xl bg-slate-950/80 border transition-all flex flex-col overflow-hidden group ${
                      isDragging ? 'opacity-40 scale-95 border-rose-500' : 'opacity-100'
                    } ${
                      isDragOver ? 'border-rose-400 ring-2 ring-rose-500/50' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* TOP BADGE KARTU */}
                    <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-rose-600/30 text-rose-300 font-bold text-xs flex items-center justify-center border border-rose-500/30">
                          {index + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          Lembar {index + 1}
                        </span>
                      </div>

                      {/* BADGE FILTER & ROTASI */}
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {page.rotation > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                            {page.rotation}°
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                          {SCAN_FILTERS[page.filter].icon} {SCAN_FILTERS[page.filter].name.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    {/* PRATINJAU GAMBAR */}
                    <div
                      className="relative h-60 bg-slate-900 flex items-center justify-center p-3 cursor-pointer overflow-hidden"
                      onClick={() => setActiveZoomIndex(index)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={page.filteredDataUrl}
                        alt={`Lembar ${index + 1}`}
                        className="max-h-full max-w-full object-contain rounded-lg shadow-md transition-transform duration-200"
                        style={{
                          transform: `rotate(${page.rotation}deg)`,
                        }}
                      />

                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                        <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-bold shadow-lg border border-slate-700/80 flex items-center gap-1.5">
                          <span>🔍</span> Perbesar Lembar
                        </span>
                      </div>
                    </div>

                    {/* KONTROL EDIT CEPAT DI SETIAP KARTU */}
                    <div className="p-3 bg-slate-950/90 border-t border-slate-800/80 space-y-2.5">
                      {/* PEMILIH FILTER PER KARTU */}
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="text-slate-400 font-medium">Filter:</span>
                        <select
                          value={page.filter}
                          onChange={(e) => void handleChangePageFilter(page.id, e.target.value as ScanFilterType)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        >
                          <option value="magic-color">✨ Warna Tajam</option>
                          <option value="magic-bw">📄 Hitam-Putih Bersih</option>
                          <option value="grayscale">🔘 Skala Abu-Abu</option>
                          <option value="original">📷 Foto Asli</option>
                        </select>
                      </div>

                      {/* TOMBOL AKSI: PUTAR, GESER, HAPUS */}
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRotatePage(index)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                          title="Putar 90 derajat searah jarum jam"
                        >
                          <span>↻</span>
                          <span className="text-[10px] font-normal">Putar</span>
                        </button>

                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMovePage(index, index - 1)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300 hover:text-white border border-slate-800 text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                          title="Pindahkan lembar ke kiri / sebelum"
                        >
                          <span>←</span>
                          <span className="text-[10px] font-normal">Maju</span>
                        </button>

                        <button
                          type="button"
                          disabled={index === pages.length - 1}
                          onClick={() => handleMovePage(index, index + 1)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300 hover:text-white border border-slate-800 text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                          title="Pindahkan lembar ke kanan / sesudah"
                        >
                          <span>→</span>
                          <span className="text-[10px] font-normal">Mundur</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePage(index)}
                          className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-800/30 text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
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

            {/* PANEL PENGATURAN PDF & TOMBOL EKSEKUSI CTA */}
            <div className="mt-8 p-6 rounded-3xl bg-slate-950/90 border border-slate-800 shadow-2xl space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⚙️</span> Pengaturan Format Dokumen PDF Akhir
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* UKURAN KERTAS */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Ukuran Kertas</span>
                    <span className="text-[11px] text-rose-400 font-normal">Rekomendasi A4</span>
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(e.target.value as ScanPageSize);
                      clearResult();
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    <option value="a4">A4 (210 × 297 mm) — Standar CPNS / Resmi</option>
                    <option value="f4">F4 / Folio (215 × 330 mm) — Kedinasan RI</option>
                    <option value="letter">US Letter (216 × 279 mm)</option>
                    <option value="fit">Sesuaikan Ukuran Foto (Auto Fit)</option>
                  </select>
                </div>

                {/* ORIENTASI */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Orientasi Halaman</label>
                  <select
                    value={orientation}
                    onChange={(e) => {
                      setOrientation(e.target.value as ScanOrientation);
                      clearResult();
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    <option value="auto">Auto (Deteksi Otomatis Tiap Lembar)</option>
                    <option value="portrait">Tegak (Portrait)</option>
                    <option value="landscape">Mendatar (Landscape)</option>
                  </select>
                </div>

                {/* MARGIN */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Margin / Batas Tepi</label>
                  <select
                    value={margin}
                    onChange={(e) => {
                      setMargin(e.target.value as ScanMargin);
                      clearResult();
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    <option value="none">Tanpa Margin (Foto Penuh ke Tepi)</option>
                    <option value="narrow">Sempit (12 pt — Rapi)</option>
                    <option value="normal">Normal (28 pt — Bingkai Cetak)</option>
                  </select>
                </div>

                {/* NAMA BERKAS */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Nama Berkas PDF</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="dokumen-pindai-scorpio"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 pr-12 font-medium"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono pointer-events-none">
                      .pdf
                    </span>
                  </div>
                </div>
              </div>

              {/* INDIKATOR STATUS PROSES */}
              {isProcessing && processStatus && (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/50 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-300">
                    <span>{processStatus.message}</span>
                    <span>
                      Langkah {processStatus.current} dari {processStatus.total}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-300"
                      style={{
                        width: `${(processStatus.current / processStatus.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {/* PESAN ERROR */}
              {processError && (
                <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800 text-red-200 text-xs sm:text-sm font-medium">
                  ⚠️ {processError}
                </div>
              )}

              {/* TOMBOL CTA UTAMA CRIMSON ROSE */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={isProcessing || pages.length === 0}
                  onClick={handleGeneratePdf}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-bold py-4 px-8 rounded-2xl shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all text-base cursor-pointer"
                >
                  <span className="text-xl">📄</span>
                  <span>
                    {isProcessing ? 'Menyusun Dokumen PDF...' : `Simpan & Buat PDF Sekarang (${pages.length} Lembar)`}
                  </span>
                </button>
              </div>
            </div>

            {/* HASIL EKSEKUSI (RESULT CARD) */}
            {result && resultUrl && (
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-rose-500/50 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-3xl shadow-lg">
                      ✓
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold mb-1">
                        Dokumen PDF Berhasil Dibuat
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-white">
                        {result.fileName}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        Ukuran: <strong className="text-white">{formatBytes(result.sizeBytes)}</strong> • Jumlah: <strong className="text-white">{result.pageCount} Halaman</strong> • Standar: <strong className="text-white">{SCAN_PAGE_SIZES[result.pageSize].label.split(' ')[0]}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800">
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
                    className="inline-flex items-center justify-center gap-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold py-3.5 px-5 rounded-2xl border border-slate-700 transition-all text-sm cursor-pointer"
                  >
                    <span>👀</span>
                    Buka Pratinjau di Tab Baru
                  </a>

                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="inline-flex items-center justify-center gap-2.5 bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 font-semibold py-3.5 px-5 rounded-2xl border border-slate-800 transition-all text-sm cursor-pointer"
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

      {/* MODAL KAMERA PEMINDAI LANGSUNG */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          {/* HEADER KAMERA */}
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
                  title="Ganti kamera depan / belakang"
                >
                  <span>🔄</span>
                  <span className="hidden sm:inline">Balik Kamera</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCloseCameraModal}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white flex items-center justify-center font-bold text-sm border border-slate-700 transition-all cursor-pointer"
                title="Tutup kamera"
              >
                ✕
              </button>
            </div>
          </div>

          {/* VIEWPORT KAMERA DENGAN FRAME PANDUAN DOKUMEN */}
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

                {/* OVERLAY FLASH SHUTTER */}
                {isFlashing && (
                  <div className="absolute inset-0 bg-white/90 z-20 pointer-events-none animate-out fade-out duration-200"></div>
                )}

                {/* FRAME PANDUAN DOKUMEN */}
                <div className="absolute inset-4 sm:inset-10 border-2 border-dashed border-rose-500/70 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
                  <div className="flex justify-between items-start text-[11px] font-mono text-rose-400/90 font-bold bg-slate-950/60 px-3 py-1 rounded-lg backdrop-blur-sm self-center">
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

          {/* BOTTOM CONTROLS: SHUTTER BUTTON & COUNTER */}
          <div className="w-full max-w-3xl flex items-center justify-between gap-4">
            <div className="text-xs text-slate-300">
              Terkumpul: <strong className="text-rose-400 font-bold">{pages.length} Lembar</strong>
            </div>

            {/* BIG SHUTTER BUTTON */}
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

      {/* MODAL ZOOM LEMBAR */}
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
