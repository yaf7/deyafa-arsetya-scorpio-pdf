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
  executeHtmlToPdf,
  formatBytes,
  GeneratedHtmlPdfResult,
  HTML_COLOR_MODES,
  HTML_MARGINS,
  HTML_ORIENTATIONS,
  HTML_PAGE_NUMBERINGS,
  HTML_PAGE_SIZES,
  HtmlColorMode,
  HtmlMargin,
  HtmlOrientation,
  HtmlPageNumbering,
  HtmlPageSize,
  HtmlToPdfOptions,
  sanitizePdfFilename,
  stripHtmlExtension,
} from '@/app/lib/html-to-pdf';
import { Navbar } from './Navbar';

export function HtmlToPdfWorkspace() {
  // Mode input pada tampilan awal: 'upload' (unggah berkas), 'code' (tempel kode), atau 'url' (tautan link web)
  const [initialInputMethod, setInitialInputMethod] = useState<'upload' | 'code' | 'url'>('upload');

  // Status dokumen: hanya aktif jika berkas/kode/link sudah berhasil dimuat
  const [isDocumentLoaded, setIsDocumentLoaded] = useState<boolean>(false);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [rawCodeInput, setRawCodeInput] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);

  // Metadata sumber berkas
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<number | null>(null);
  const [sourceType, setSourceType] = useState<'file' | 'code' | 'url'>('file');

  // Opsi Konversi PDF
  const [pageSize, setPageSize] = useState<HtmlPageSize>('a4');
  const [orientation, setOrientation] = useState<HtmlOrientation>('portrait');
  const [margin, setMargin] = useState<HtmlMargin>('normal');
  const [colorMode, setColorMode] = useState<HtmlColorMode>('full');
  const [scalePercent, setScalePercent] = useState<number>(100);
  const [pageNumbering, setPageNumbering] = useState<HtmlPageNumbering>('bottom-center');
  const [outputName, setOutputName] = useState<string>('dokumen-html-scorpio');

  // Tab Tampilan Saat Dokumen Aktif: 'preview' (WYSIWYG Lembar PDF) atau 'code' (Editor Kode)
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

  // Status Proses & Notifikasi
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [convertProgress, setConvertProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hasil PDF
  const [result, setResult] = useState<GeneratedHtmlPdfResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Drag & Drop State
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Refs DOM
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeResultUrlRef = useRef<string | null>(null);

  // Bersihkan Object URLs saat unmount
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

  // 1. Metode Input 1: Unggah Berkas .HTML dari Komputer
  const handleUploadFile = useCallback(
    (file: File) => {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.html') && !lower.endsWith('.htm')) {
        setErrorMessage('Format berkas harus berupa dokumen HTML yang valid (.html atau .htm).');
        return;
      }

      setErrorMessage(null);
      clearResult();

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text && text.trim().length > 0) {
          setHtmlContent(text);
          setRawCodeInput(text);
          setUploadedFileName(file.name);
          setUploadedFileSize(file.size);
          setSourceType('file');
          setOutputName(stripHtmlExtension(file.name));
          setIsDocumentLoaded(true);
          setActiveTab('preview');
        } else {
          setErrorMessage('Berkas HTML tersebut kosong atau tidak dapat dibaca.');
        }
      };
      reader.onerror = () => {
        setErrorMessage('Gagal membaca berkas HTML. Pastikan berkas tidak terkunci atau rusak.');
      };
      reader.readAsText(file);
    },
    [clearResult]
  );

  // 2. Metode Input 2: Tempel / Tulis Kode HTML Langsung
  const handleApplyRawCode = () => {
    if (!rawCodeInput.trim()) {
      setErrorMessage('Ketik atau tempel kode HTML terlebih dahulu sebelum melanjutkan.');
      return;
    }
    setErrorMessage(null);
    clearResult();
    setHtmlContent(rawCodeInput);
    setUploadedFileName('kode-kustom.html');
    setUploadedFileSize(new Blob([rawCodeInput]).size);
    setSourceType('code');
    setOutputName('dokumen-html-kustom');
    setIsDocumentLoaded(true);
    setActiveTab('preview');
  };

  // 3. Metode Input 3: Ambil Konten dari Link / URL Website
  const handleFetchUrl = async (overrideUrl?: string) => {
    const rawTarget = overrideUrl || urlInput;
    let url = rawTarget.trim();

    if (!url) {
      setErrorMessage('Masukkan tautan URL web publik (misal: https://example.com) yang ingin dikonversi.');
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    setErrorMessage(null);
    setIsLoadingUrl(true);
    clearResult();

    try {
      const res = await fetch('/api/fetch-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Gagal memuat halaman web.');
      }

      setHtmlContent(data.html);
      setRawCodeInput(data.html);
      setUploadedFileName(data.title ? `${data.title}.html` : 'Halaman Web');
      setUploadedFileSize(new Blob([data.html]).size);
      setSourceType('url');
      setOutputName(data.title ? sanitizePdfFilename(data.title).replace(/\.pdf$/i, '') : 'halaman-web');
      setIsDocumentLoaded(true);
      setActiveTab('preview');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memuat halaman web dari tautan. Pastikan URL dapat diakses publik.'
      );
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Tempel Tautan dari Clipboard
  const handlePasteUrlFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
      }
    } catch {
      // Browser mungkin membatasi izin clipboard
    }
  };

  // Reset Total: Kembalikan ke Dropzone Awal
  const handleResetDocument = () => {
    clearResult();
    setErrorMessage(null);
    setIsDocumentLoaded(false);
    setHtmlContent('');
    setRawCodeInput('');
    setUrlInput('');
    setUploadedFileName(null);
    setUploadedFileSize(null);
    setOutputName('dokumen-html-scorpio');
    setActiveTab('preview');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Dukungan Ctrl + V untuk Paste Berkas HTML dari Clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isDocumentLoaded) return;
      if (!e.clipboardData?.files?.length) return;
      const file = Array.from(e.clipboardData.files).find((f) => {
        const lower = f.name.toLowerCase();
        return lower.endsWith('.html') || lower.endsWith('.htm');
      });
      if (file) {
        e.preventDefault();
        handleUploadFile(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleUploadFile, isDocumentLoaded]);

  // Drag & Drop Handlers
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
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  // DOKUMEN HTML TERISOLASI UNTUK PRATINJAU IFRAME:
  // - Mengisolasi CSS dan warna secara 100% sehingga tidak membocorkan gaya ke situs ScorpioPDF
  // - Menghindari bug warna transparan, teks hilang, atau CSS clash
  // - Menerapkan margin, background putih bersih, dan mode Grayscale / Hemat Tinta secara tepat
  const preparedHtmlDoc = useMemo(() => {
    if (!htmlContent) return '';

    const currentMargin = HTML_MARGINS[margin];
    const isGrayscale = colorMode === 'grayscale';
    const isClean = colorMode === 'clean';

    const injectedStyle = `
      <style id="scorpio-isolated-preview-style">
        *, *::before, *::after {
          box-sizing: border-box;
        }
        html {
          background-color: #ffffff;
          ${isGrayscale ? 'filter: grayscale(100%) !important;' : ''}
        }
        body {
          margin: 0 !important;
          padding: ${currentMargin.cssPadding} !important;
          background-color: ${isClean ? '#ffffff !important;' : '#ffffff;'};
          color: ${isClean ? '#000000 !important;' : 'inherit;'};
          word-break: break-word;
          overflow-wrap: break-word;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        ${
          isClean
            ? `
        * {
          background-color: transparent !important;
          color: #000000 !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }
        img {
          filter: contrast(120%) !important;
        }
        `
            : ''
        }
      </style>
    `;

    if (/<head[^>]*>/i.test(htmlContent)) {
      return htmlContent.replace(/<head[^>]*>/i, `$&\n${injectedStyle}`);
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${injectedStyle}
</head>
<body>
  ${htmlContent}
</body>
</html>`;
  }, [htmlContent, margin, colorMode]);

  // Eksekusi Konversi HTML ke PDF
  const handleStartConversion = async () => {
    if (!iframeRef.current) {
      setErrorMessage('Elemen dokumen HTML belum siap untuk dikonversi.');
      return;
    }

    setErrorMessage(null);
    clearResult();
    setIsConverting(true);
    setConvertProgress({ current: 1, total: 4 });

    try {
      const options: HtmlToPdfOptions = {
        pageSize,
        orientation,
        margin,
        colorMode,
        scalePercent,
        pageNumbering,
        outputName,
      };

      const res = await executeHtmlToPdf(iframeRef.current, options, (cur, tot) => {
        setConvertProgress({ current: cur, total: tot });
      });

      const url = URL.createObjectURL(res.blob);
      activeResultUrlRef.current = url;
      setResultUrl(url);
      setResult(res);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mengonversi konten HTML ke PDF. Pastikan format HTML valid.'
      );
    } finally {
      setIsConverting(false);
      setConvertProgress(null);
    }
  };

  // Rasio Aspek Lembar Kertas Pratinjau
  const paperRatio =
    orientation === 'landscape'
      ? `${HTML_PAGE_SIZES[pageSize].heightPt} / ${HTML_PAGE_SIZES[pageSize].widthPt}`
      : `${HTML_PAGE_SIZES[pageSize].widthPt} / ${HTML_PAGE_SIZES[pageSize].heightPt}`;

  const currentMargin = HTML_MARGINS[margin];

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
        accept=".html,.htm"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFile(e.target.files[0]);
          }
        }}
        className="hidden"
        aria-label="Pilih berkas HTML"
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
            <span className="text-slate-400">KONVERSI KE PDF</span>
            <span>/</span>
            <span className="font-bold text-slate-900">HTML ke PDF</span>
          </div>

          {/* Indikator Sumber Saat Dokumen Sudah Dimuat */}
          {isDocumentLoaded && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-2xs border border-slate-200">
                <span className="text-amber-600 font-extrabold">
                  {sourceType === 'file' ? '📄' : sourceType === 'url' ? '🔗' : '💻'}
                </span>
                <span className="max-w-[180px] truncate">{uploadedFileName || 'Dokumen HTML'}</span>
                {uploadedFileSize && (
                  <span className="text-slate-400 font-mono text-[11px]">({formatBytes(uploadedFileSize)})</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (sourceType === 'file') {
                    fileInputRef.current?.click();
                  } else {
                    handleResetDocument();
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Ganti Sumber
              </button>
              <button
                type="button"
                onClick={handleResetDocument}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-2xs transition hover:bg-rose-100 cursor-pointer"
              >
                Hapus &amp; Reset
              </button>
            </div>
          )}
        </div>

        {/* Hero Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-amber-50/80 px-3.5 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider shadow-2xs">
            <svg className="h-3.5 w-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            KONVERSI KE PDF • Render HTML Presisi &amp; Bebas Error Warna
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">
            Konversi <span className="text-amber-600">Berkas, Kode &amp; Link URL</span> Jadi PDF
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Ubah berkas .html, kode HTML mentah, atau halaman dari tautan URL website publik menjadi dokumen PDF siap cetak dengan resolusi tinggi. Tampilan warna terisolasi aman tanpa bocor atau merusak tema antarmuka.
          </p>
        </div>

        {/* Notifikasi Pesan Kesalahan */}
        {errorMessage && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 sm:text-sm shadow-xs">
            <svg className="h-5 w-5 shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 font-medium">{errorMessage}</div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 1: BELUM ADA DOKUMEN DIMUAT (TAMPILKAN DROPZONE 3 METODE TANPA CONTOH/TEMPLATE) */}
        {/* ========================================================================================= */}
        {!isDocumentLoaded && (
          <div className="mx-auto w-full max-w-3xl space-y-4">
            {/* Pilihan 3 Metode Input: Unggah Berkas, Tempel Kode, atau Masukkan Link URL */}
            <div className="flex items-center justify-center">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-xs">
                {/* Tab 1: Unggah Berkas */}
                <button
                  type="button"
                  onClick={() => setInitialInputMethod('upload')}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                    initialInputMethod === 'upload'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Unggah Berkas .HTML</span>
                </button>

                {/* Tab 2: Masukkan Link URL */}
                <button
                  type="button"
                  onClick={() => setInitialInputMethod('url')}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                    initialInputMethod === 'url'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Tambah Lewat Link URL</span>
                </button>

                {/* Tab 3: Tempel Kode */}
                <button
                  type="button"
                  onClick={() => setInitialInputMethod('code')}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                    initialInputMethod === 'code'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span>Tempel Kode HTML</span>
                </button>
              </div>
            </div>

            {/* Opsi 1: Dropzone Unggah Berkas .html */}
            {initialInputMethod === 'upload' && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-300 ${
                  isDraggingFile
                    ? 'border-amber-500 bg-amber-50/70 shadow-2xl scale-[1.01]'
                    : 'border-slate-300/80 bg-white/95 shadow-xl shadow-slate-200/50 hover:border-amber-400 hover:bg-white hover:shadow-2xl hover:scale-[1.005]'
                }`}
              >
                {/* Visual Icon */}
                <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white shadow-lg shadow-amber-500/30 transition-transform duration-300 group-hover:scale-110">
                  <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md border-2 border-white">
                    <span className="text-[10px] font-black font-mono">HTML</span>
                  </div>
                </div>

                <p className="font-display text-lg sm:text-xl font-black text-slate-900">
                  Pilih atau Tarik Berkas HTML ke Sini
                </p>
                <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Mendukung berkas <strong className="text-slate-800">.html</strong> atau <strong className="text-slate-800">.htm</strong>. Anda juga dapat menempel berkas langsung dengan <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 border border-slate-300">Ctrl + V</kbd>.
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
                    <span>Pilih Berkas HTML dari Komputer</span>
                  </button>
                </div>

                {/* Keunggulan Fitur */}
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>Warna Terisolasi &amp; Anti Error</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>Dukungan CSS Inline &amp; Gambar Data-URI</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span>Ukuran Standar A4 / F4 / Folio</span>
                  </div>
                </div>
              </div>
            )}

            {/* Opsi 2: Masukkan Link / URL Halaman Web */}
            {initialInputMethod === 'url' && (
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-xl shadow-slate-200/50 space-y-6">
                <div className="text-center max-w-lg mx-auto">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white shadow-md shadow-amber-500/25">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    Konversi Halaman Web dari Tautan / Link URL
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                    Ketik atau tempel alamat URL situs web publik (misal artikel berita, dokumentasi, blog, atau struk tagihan online).
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="relative flex items-center">
                    <div className="pointer-events-none absolute left-4 text-slate-400">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleFetchUrl();
                      }}
                      placeholder="https://contoh-website.com/artikel-atau-laporan"
                      disabled={isLoadingUrl}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 py-4 pl-12 pr-28 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 shadow-inner transition focus:border-amber-500 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handlePasteUrlFromClipboard}
                      className="absolute right-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                    >
                      📋 Tempel
                    </button>
                  </div>

                  {/* Tombol Ambil Konten dari Link */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-400">Coba Tautan:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setUrlInput('https://id.wikipedia.org/wiki/Indonesia');
                          void handleFetchUrl('https://id.wikipedia.org/wiki/Indonesia');
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-amber-800 font-bold hover:bg-amber-50 transition cursor-pointer"
                      >
                        Wikipedia Indonesia
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleFetchUrl()}
                      disabled={isLoadingUrl || !urlInput.trim()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-7 py-3.5 text-xs sm:text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                    >
                      {isLoadingUrl ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Mengambil Konten Web...</span>
                        </>
                      ) : (
                        <>
                          <span>Ambil Konten dari Link &amp; Buka Pratinjau</span>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Opsi 3: Tempel / Tulis Kode HTML Mentah */}
            {initialInputMethod === 'code' && (
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Tempel atau Tulis Kode HTML Anda
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Masukkan sintaks HTML lengkap (termasuk tag &lt;style&gt; atau CSS inline jika ada)
                    </p>
                  </div>
                  <span className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-800">
                    RAW HTML
                  </span>
                </div>

                <textarea
                  value={rawCodeInput}
                  onChange={(e) => setRawCodeInput(e.target.value)}
                  rows={14}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-400 leading-relaxed focus:border-amber-400 focus:outline-none shadow-inner"
                  placeholder={`<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { font-family: sans-serif; padding: 24px; }\n    h1 { color: #e11d48; }\n    p { color: #334155; line-height: 1.6; }\n  </style>\n</head>\n<body>\n  <h1>Dokumen Saya</h1>\n  <p>Tulis atau tempel konten HTML Anda di sini...</p>\n</body>\n</html>`}
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-400 font-mono">
                    {rawCodeInput.length > 0 ? `${rawCodeInput.length} karakter dimasukkan` : 'Kotak kode masih kosong'}
                  </span>

                  <button
                    type="button"
                    onClick={handleApplyRawCode}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 px-6 shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all cursor-pointer text-xs"
                  >
                    <span>Muat Kode &amp; Buka Pratinjau</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 2: DOKUMEN TELAH DIMUAT (TAMPILKAN PRATINJAU IFRAME LIVE & OPSI KONVERSI) */}
        {/* ========================================================================================= */}
        {isDocumentLoaded && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Kolom Kiri: Pratinjau Lembar Kertas PDF Live (WYSIWYG) & Editor Kode (lg:col-span-8) */}
            <div className="space-y-4 lg:col-span-8">
              {/* Header Toolbar: Tab Peralihan & Info Sumber */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Dokumen: <span className="text-amber-700">{uploadedFileName || 'Dokumen HTML'}</span>
                  </span>
                  <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                    {sourceType === 'file' ? 'Berkas' : sourceType === 'url' ? 'Link Web' : 'Kode'}
                  </span>
                </div>

                {/* Tab Switcher: Pratinjau Lembar vs Editor Kode */}
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold text-slate-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition cursor-pointer ${
                      activeTab === 'preview'
                        ? 'bg-white text-amber-800 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>Pratinjau Lembar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('code')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition cursor-pointer ${
                      activeTab === 'code'
                        ? 'bg-white text-amber-800 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span>Edit Kode HTML</span>
                  </button>
                </div>
              </div>

              {/* BAR STATUS PILIHAN OPSI AKTIF (LIVE PRATINJAU STATUS) */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
                  Status Pratinjau:
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                  <span className="text-slate-400 font-normal">Kertas:</span>
                  <span className="text-amber-800 font-bold">{pageSize.toUpperCase()}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                  <span className="text-slate-400 font-normal">Orientasi:</span>
                  <span className="text-amber-800 font-bold">
                    {orientation === 'portrait' ? 'Tegak (Portrait)' : 'Mendatar (Landscape)'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                  <span className="text-slate-400 font-normal">Margin:</span>
                  <span className="text-slate-700 font-bold">{currentMargin.label.split('(')[0].trim()}</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold shadow-2xs transition-colors ${
                    colorMode === 'grayscale'
                      ? 'border-slate-400 bg-slate-200 text-slate-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="text-slate-400 font-normal">Warna:</span>
                  <span>{HTML_COLOR_MODES[colorMode].label.split('(')[0].trim()}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                  <span className="text-slate-400 font-normal">Skala:</span>
                  <span className="text-amber-800 font-mono">{scalePercent}%</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                  <span className="text-slate-400 font-normal">Nomor:</span>
                  <span className="text-slate-700">{HTML_PAGE_NUMBERINGS[pageNumbering].tag}</span>
                </span>
              </div>

              {/* AREA UTAMA 1: PRATINJAU LEMBAR KERTAS PDF LIVE DENGAN IFRAME TERISOLASI */}
              {activeTab === 'preview' && (
                <div className="flex justify-center rounded-3xl border border-slate-200/90 bg-slate-200/60 p-4 sm:p-8 shadow-inner overflow-auto">
                  <div
                    style={{
                      width: orientation === 'landscape' ? '100%' : '84%',
                      maxWidth: orientation === 'landscape' ? '920px' : '660px',
                      aspectRatio: paperRatio,
                      filter: colorMode === 'grayscale' ? 'grayscale(100%)' : 'none',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-300 min-h-[580px]"
                  >
                    {/* Tag Indikator Kertas & Orientasi Sudut Atas */}
                    <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-center gap-1.5 opacity-70">
                      <span className="rounded bg-slate-900/80 px-2 py-0.5 text-[9px] font-mono font-bold text-white shadow-2xs backdrop-blur-xs">
                        {pageSize.toUpperCase()} ({HTML_PAGE_SIZES[pageSize].mm})
                      </span>
                      <span className="rounded bg-amber-600/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-2xs backdrop-blur-xs">
                        {orientation === 'landscape' ? 'Lanskap' : 'Potret'}
                      </span>
                    </div>

                    {/* IFRAME TERISOLASI AMAN DARI ERROR WARNA MAUPUN PERUBAHAN STYLE */}
                    <iframe
                      ref={iframeRef}
                      srcDoc={preparedHtmlDoc}
                      title="Pratinjau HTML ke PDF"
                      className="h-full w-full border-0 bg-white"
                      style={{
                        transform: `scale(${scalePercent / 100})`,
                        transformOrigin: 'top left',
                        width: `${100 * (100 / scalePercent)}%`,
                        height: `${100 * (100 / scalePercent)}%`,
                        minHeight: '620px',
                      }}
                    />

                    {/* SIMULASI PENOMORAN HALAMAN LIVE */}
                    {pageNumbering !== 'none' && (
                      <div
                        className={`pointer-events-none absolute z-20 flex items-center gap-1 rounded bg-slate-900/80 px-2 py-0.5 font-mono text-[9px] font-bold text-white shadow-md ring-1 ring-white/30 backdrop-blur-xs transition-all duration-200 ${
                          pageNumbering === 'bottom-center'
                            ? 'bottom-2.5 left-1/2 -translate-x-1/2'
                            : pageNumbering === 'bottom-right'
                            ? 'bottom-2.5 right-3'
                            : 'top-2.5 left-3'
                        }`}
                      >
                        <svg className="h-2.5 w-2.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        <span>Hal 1 dari 1</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AREA UTAMA 2: EDITOR KODE HTML LANGSUNG */}
              {activeTab === 'code' && (
                <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Editor Kode HTML Sumber
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (Dukungan inline CSS &amp; tag HTML lengkap)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                    >
                      Lihat Hasil Pratinjau →
                    </button>
                  </div>

                  <textarea
                    value={htmlContent}
                    onChange={(e) => {
                      setHtmlContent(e.target.value);
                      clearResult();
                    }}
                    rows={20}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-400 leading-relaxed focus:border-amber-400 focus:outline-none shadow-inner"
                    placeholder="Ketik atau tempel kode HTML Anda di sini..."
                  />
                </div>
              )}
            </div>

            {/* Kolom Kanan: Pengaturan Konversi & Tombol Aksi (lg:col-span-4) */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-6 sticky top-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Opsi Format PDF
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesuaikan ukuran kertas, orientasi, margin, dan warna
                  </p>
                </div>

                {/* 1. Ukuran Kertas Dokumen */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ukuran Kertas Dokumen
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as HtmlPageSize)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold text-slate-800 transition focus:border-amber-500 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    {(Object.keys(HTML_PAGE_SIZES) as HtmlPageSize[]).map((key) => (
                      <option key={key} value={key}>
                        {HTML_PAGE_SIZES[key].label} ({HTML_PAGE_SIZES[key].mm})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    {HTML_PAGE_SIZES[pageSize].desc}
                  </p>
                </div>

                {/* 2. Orientasi Halaman */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Orientasi Halaman
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(HTML_ORIENTATIONS) as HtmlOrientation[]).map((key) => {
                      const item = HTML_ORIENTATIONS[key];
                      const isSelected = orientation === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setOrientation(key)}
                          className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer select-none ${
                            isSelected
                              ? 'border-amber-600 bg-amber-50 text-amber-950 ring-2 ring-amber-500/25 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {isSelected && (
                            <svg className="h-3 w-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <span>{item.label.split('(')[0].trim()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Margin Kertas */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Margin Halaman
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(HTML_MARGINS) as HtmlMargin[]).map((key) => {
                      const item = HTML_MARGINS[key];
                      const isSelected = margin === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setMargin(key)}
                          className={`rounded-xl border p-2 text-left transition select-none cursor-pointer ${
                            isSelected
                              ? 'border-amber-600 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/25 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span>{item.label.split('(')[0].trim()}</span>
                            {isSelected && (
                              <svg className="h-3 w-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">{item.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Mode Skema Warna */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Skema Warna &amp; Latar Belakang
                  </label>
                  <div className="space-y-2">
                    {(Object.keys(HTML_COLOR_MODES) as HtmlColorMode[]).map((key) => {
                      const item = HTML_COLOR_MODES[key];
                      const isSelected = colorMode === key;
                      return (
                        <div
                          key={key}
                          onClick={() => setColorMode(key)}
                          className={`cursor-pointer rounded-2xl border p-2.5 transition select-none ${
                            isSelected
                              ? 'border-amber-600 bg-amber-50/70 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span>{item.label}</span>
                            {isSelected && (
                              <svg className="h-3.5 w-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <p className="text-[10.5px] text-slate-500 font-normal leading-tight">
                            {item.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Skala Konten (Zoom) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold uppercase tracking-wider text-slate-700">
                      Skala Konten
                    </label>
                    <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {scalePercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={75}
                    max={120}
                    step={5}
                    value={scalePercent}
                    onChange={(e) => setScalePercent(parseInt(e.target.value, 10))}
                    className="h-2 w-full cursor-pointer accent-amber-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>75% (Muat Banyak)</span>
                    <span>100% (Normal)</span>
                    <span>120% (Besar)</span>
                  </div>
                </div>

                {/* 6. Penomoran Halaman Otomatis */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Penomoran Halaman
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(HTML_PAGE_NUMBERINGS) as HtmlPageNumbering[]).map((key) => {
                      const item = HTML_PAGE_NUMBERINGS[key];
                      const isSelected = pageNumbering === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPageNumbering(key)}
                          className={`rounded-xl border p-2 text-left transition select-none cursor-pointer ${
                            isSelected
                              ? 'border-amber-600 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span>{item.tag}</span>
                            {isSelected && (
                              <svg className="h-3 w-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">{item.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 7. Nama File Output */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nama File PDF
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="dokumen-html"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-12 text-xs font-semibold text-slate-800 transition focus:border-amber-500 focus:bg-white focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-xs font-bold text-amber-700">
                      .pdf
                    </span>
                  </div>
                </div>

                {/* Indikator Progres Konversi */}
                {isConverting && convertProgress && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span>Merender dan menyusun dokumen PDF...</span>
                      <span>{Math.round((convertProgress.current / convertProgress.total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200">
                      <div
                        className="h-full bg-amber-600 transition-all duration-200"
                        style={{
                          width: `${(convertProgress.current / convertProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Tombol CTA Utama (Crimson Rose Menonjol & Jelas) */}
                <button
                  type="button"
                  onClick={handleStartConversion}
                  disabled={isConverting}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all duration-200 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isConverting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Merender PDF Vektor...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Konversi HTML ke PDF Sekarang</span>
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
          <div className="mt-8 rounded-3xl border border-amber-200 bg-white p-6 sm:p-8 shadow-xl shadow-amber-500/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-md shadow-amber-600/30">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full uppercase">
                      Konversi Berhasil
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
                  <span>Unduh File PDF Sekarang</span>
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
                <div className="text-xs font-semibold text-slate-500">Ukuran Kertas</div>
                <div className="text-2xl font-black text-slate-900 mt-1 uppercase">
                  {pageSize}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Jumlah Halaman</div>
                <div className="text-2xl font-black text-amber-700 mt-1">
                  {result.pageCount} Halaman
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Ukuran File</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {formatBytes(result.sizeBytes)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Orientasi Dokumen</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {orientation === 'portrait' ? 'Potret' : 'Lanskap'}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
