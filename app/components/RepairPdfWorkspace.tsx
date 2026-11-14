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
  executeRepairPdf,
  formatBytes,
  GeneratedRepairResult,
  inspectCorruptedPdf,
  PdfDiagnosticResult,
  RepairSeverity,
  stripPdfExtension,
} from '@/app/lib/repair-pdf';
import { Navbar } from './Navbar';

export function RepairPdfWorkspace() {
  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [diagnostic, setDiagnostic] = useState<PdfDiagnosticResult | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Settings
  const [outputName, setOutputName] = useState<string>('');
  const [repairStrategy, setRepairStrategy] = useState<'auto' | 'native' | 'salvage'>('auto');

  // Execution & Progress State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<{ step: number; total: number; message: string } | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);

  // Result State
  const [result, setResult] = useState<GeneratedRepairResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Drag & Drop
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeResultUrlRef = useRef<string | null>(null);

  // Cleanup object URLs on unmount
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

  // Handle File Selection
  const handleSelectFile = useCallback(
    async (file: File) => {
      setInspectError(null);
      setProcessError(null);
      clearResult();

      setSelectedFile(file);
      setOutputName(`${stripPdfExtension(file.name)}-pulih`);
      setIsInspecting(true);

      try {
        const diag = await inspectCorruptedPdf(file);
        setDiagnostic(diag);
      } catch (err) {
        console.error(err);
        setInspectError(
          err instanceof Error
            ? err.message
            : 'Gagal menganalisis berkas. Pastikan berkas berformat PDF atau memiliki data biner dokumen.'
        );
      } finally {
        setIsInspecting(false);
      }
    },
    [clearResult]
  );

  // Reset Document
  const handleReset = () => {
    clearResult();
    setSelectedFile(null);
    setDiagnostic(null);
    setInspectError(null);
    setProcessError(null);
    setOutputName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clipboard Paste (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (selectedFile) return;
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
  }, [handleSelectFile, selectedFile]);

  // Drag & Drop Events
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

  // Execute Repair
  const handleExecuteRepair = async () => {
    if (!selectedFile || !diagnostic) return;

    setIsProcessing(true);
    setProcessError(null);
    clearResult();

    try {
      const rep = await executeRepairPdf(
        selectedFile,
        diagnostic,
        {
          outputName: outputName.trim() || undefined,
          preferredStrategy: repairStrategy,
        },
        (step, total, message) => {
          setProcessStatus({ step, total, message });
        }
      );

      const url = URL.createObjectURL(rep.blob);
      activeResultUrlRef.current = url;
      setResultUrl(url);
      setResult(rep);
    } catch (err) {
      console.error(err);
      setProcessError(
        err instanceof Error
          ? err.message
          : 'Terjadi kegagalan saat proses pemulihan struktur berkas. Silakan coba mode Pemulihan Halaman Mendalam.'
      );
    } finally {
      setIsProcessing(false);
      setProcessStatus(null);
    }
  };

  const getSeverityBadge = (sev: RepairSeverity) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase tracking-wider">
            Kritis
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
            Korup
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200 text-[10px] font-bold uppercase tracking-wider">
            Anomali
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
            Info
          </span>
        );
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
            🛠️
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-white">Lepaskan Berkas PDF yang Rusak di Sini</h3>
          <p className="text-rose-200 mt-2 text-sm md:text-base font-medium">
            Mesin ScorpioPDF akan langsung memindai dan mendiagnosa struktur berkas
          </p>
        </div>
      )}

      {/* Input File Tersembunyi */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.files && e.target.files.length > 0) {
            void handleSelectFile(e.target.files[0]);
          }
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
            <span className="text-slate-400">OPTIMALKAN PDF</span>
            <span>/</span>
            <span className="font-bold text-slate-900">Perbaiki PDF</span>
          </div>

          {selectedFile && diagnostic && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-2xs border border-slate-200">
                <span className="text-lime-600 font-extrabold">🩺</span>
                <span className="max-w-[200px] truncate">{selectedFile.name}</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  ({formatBytes(diagnostic.originalSize)})
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
                onClick={handleReset}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-2xs transition hover:bg-rose-100 cursor-pointer"
              >
                Hapus
              </button>
            </div>
          )}
        </div>

        {/* Hero Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-200/90 bg-lime-50/80 px-3.5 py-1 text-xs font-bold text-lime-900 uppercase tracking-wider shadow-2xs">
            <svg className="h-3.5 w-3.5 text-lime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            RESTORASI DOKUMEN • Diagnosa &amp; Perbaikan Biner
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">
            Perbaiki Dokumen PDF <span className="text-lime-700">(Corrupted PDF Recovery)</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Selamatkan berkas PDF yang rusak, gagal terbuka, atau terputus saat diunduh. ScorpioPDF merekonstruksi tabel XRef, menambal header biner, dan menyelamatkan seluruh halaman secara aman tanpa unggah ke server.
          </p>
        </div>

        {/* Notifikasi Pesan Kesalahan */}
        {(inspectError || processError) && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 sm:text-sm shadow-xs">
            <div className="flex-1 font-medium">{inspectError || processError}</div>
            <button
              onClick={() => {
                setInspectError(null);
                setProcessError(null);
              }}
              className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 1: BELUM ADA FILE (DROPZONE BERSIH TANPA PREVIEW DUMMY) */}
        {/* ========================================================================================= */}
        {!selectedFile && (
          <div className="mx-auto w-full max-w-3xl space-y-8 animate-in fade-in zoom-in-95 duration-200">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-300 ${
                isDraggingFile
                  ? 'border-lime-500 bg-lime-50/70 shadow-2xl scale-[1.01]'
                  : 'border-slate-300/80 bg-white/95 shadow-xl shadow-slate-200/50 hover:border-lime-500 hover:bg-white hover:shadow-2xl'
              }`}
            >
              {/* Visual Icon */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-lime-600 to-emerald-500 text-white shadow-lg shadow-lime-500/30 transition-transform duration-300 group-hover:scale-110">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md border-2 border-white">
                  <span className="text-[10px] font-black font-mono">FIX</span>
                </div>
              </div>

              {isInspecting ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-lime-600 border-t-transparent" />
                  <p className="text-base font-semibold text-slate-700">
                    Mendiagnosa biner dan hierarki objek PDF...
                  </p>
                </div>
              ) : (
                <>
                  <p className="font-display text-lg sm:text-xl font-black text-slate-900">
                    Pilih atau Tarik Berkas PDF Rusak ke Sini
                  </p>
                  <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Unggah berkas dokumen PDF yang rusak, tidak bisa dibuka, atau hilang ekor datanya. Anda juga dapat menempel berkas langsung dengan <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 border border-slate-300">Ctrl + V</kbd>.
                  </p>

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
                      <span>Pilih Berkas PDF yang Bermasalah</span>
                    </button>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lime-600 font-bold">✓</span>
                      <span>Mendukung PDF Truncated &amp; Corrupt</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lime-600 font-bold">✓</span>
                      <span>Rekonstruksi Tabel XRef Otomatis</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lime-600 font-bold">✓</span>
                      <span>100% Client-Side Tanpa Unggah Server</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 3 Kartu Keunggulan Pemulihan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center text-xl mb-3 font-bold">
                  🩺
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Diagnosa Byte Cerdas</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Mendeteksi letak ketidaksesuaian header, pemotongan berkas di tengah jalan, dan kerusakan pointer indeks XRef secara instan.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-700 flex items-center justify-center text-xl mb-3 font-bold">
                  ⚡
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Rekonstruksi Struktur Vektor</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Membangun tabel indeks silang baru dari awal dan menormalisasi hierarki halaman agar dokumen kembali kompatibel dengan semua PDF reader.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center text-xl mb-3 font-bold">
                  🛡️
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Deep Page Salvage</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Mesin penyerap darurat untuk menyelamatkan seluruh konten visual lembar demi lembar jika struktur biner internal telah rusak total.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* KONDISI 2: FILE TERPILIH & TELAH DIDIAGNOSA */}
        {/* ========================================================================================= */}
        {selectedFile && diagnostic && !isInspecting && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Kartu Diagnostik Kesehatan Dokumen */}
            <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="text-lime-600">🩺</span> Laporan Diagnostik Struktur Dokumen
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hasil pemindaian integritas biner dan hierarki objek PDF Anda.
                  </p>
                </div>

                {/* Indikator Skor Kesehatan */}
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl">
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400 font-medium">Integritas Awal:</div>
                    <div className="text-xs font-bold text-slate-800">{diagnostic.statusLabel}</div>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm border ${
                      diagnostic.healthScore >= 90
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : diagnostic.healthScore >= 60
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {diagnostic.healthScore}%
                  </div>
                </div>
              </div>

              {/* Temuan Masalah */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Temuan Masalah &amp; Rencana Restorasi ({diagnostic.issues.length}):
                </div>

                {diagnostic.issues.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
                    <span className="text-xl">✓</span>
                    <span>Struktur berkas ini masih utuh. Mesin ScorpioPDF akan melakukan restrukturisasi pembersihan standar ISO 32000 untuk memastikan dokumen 100% kompatibel di semua perangkat.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {diagnostic.issues.map((issue) => (
                      <div
                        key={issue.id}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{issue.title}</span>
                            {getSeverityBadge(issue.severity)}
                          </div>
                          <p className="text-slate-500 leading-relaxed text-[11px]">{issue.desc}</p>
                        </div>
                        <span className="shrink-0 px-2 py-1 rounded bg-white text-rose-600 border border-slate-200 font-mono text-[10px] font-bold shadow-2xs">
                          Akan Dipulihkan
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pengaturan Pemulihan */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Strategi Pemulihan</label>
                    <select
                      value={repairStrategy}
                      onChange={(e) => {
                        setRepairStrategy(e.target.value as 'auto' | 'native' | 'salvage');
                        clearResult();
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-lime-500 font-medium"
                    >
                      <option value="auto">⚡ Otomatis (Rekomendasi Cerdas Scorpio)</option>
                      <option value="native">📐 Rekonstruksi Struktur Utuh (Vektor &amp; Font Asli)</option>
                      <option value="salvage">🛡️ Pemulihan Halaman Mendalam (Deep Page Salvage)</option>
                    </select>
                    <p className="text-[11px] text-slate-400">
                      {repairStrategy === 'auto' && 'Mencoba mempertahankan kualitas teks dan vektor asli. Jika kerusakan biner parah, otomatis mengaktifkan deep salvage.'}
                      {repairStrategy === 'native' && 'Membangun ulang tabel XRef dan pohon objek tanpa mengorbankan ketajaman teks asli.'}
                      {repairStrategy === 'salvage' && 'Merender setiap halaman yang dapat diselamatkan ke kanvas High-DPI darurat jika struktur biner rusak parah.'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Nama Berkas Hasil Pemulihan</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={outputName}
                        onChange={(e) => setOutputName(e.target.value)}
                        placeholder="dokumen-pulih"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-lime-500 pr-12 font-medium"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono pointer-events-none">
                        .pdf
                      </span>
                    </div>
                  </div>
                </div>

                {/* Indikator Status Proses */}
                {isProcessing && processStatus && (
                  <div className="p-4 rounded-2xl bg-lime-50 border border-lime-200 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-bold text-lime-900">
                      <span>{processStatus.message}</span>
                      <span>
                        Langkah {processStatus.step} dari {processStatus.total}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-lime-200/60 overflow-hidden">
                      <div
                        className="h-full bg-lime-600 transition-all duration-300"
                        style={{
                          width: `${(processStatus.step / processStatus.total) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Tombol CTA Utama */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleExecuteRepair}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-bold py-4 px-8 rounded-2xl shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all text-sm cursor-pointer"
                  >
                    <span className="text-lg">🛠️</span>
                    <span>
                      {isProcessing ? 'Memulihkan Struktur Dokumen...' : 'Perbaiki & Pulihkan PDF Sekarang'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Hasil Repair (Result Card) */}
            {result && resultUrl && (
              <div className="p-6 sm:p-8 rounded-3xl border-2 border-emerald-500/40 bg-white shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-3xl shadow-xs font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mb-1">
                        Dokumen Berhasil Dipulihkan (Skor: 100%)
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                        {result.fileName}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        Ukuran: <strong className="text-slate-800">{formatBytes(result.repairedSize)}</strong> (sebelumnya {formatBytes(result.originalSize)}) • <strong className="text-slate-800">{result.pageCount} Halaman Terselamatkan</strong> • Mode: <span className="text-rose-600 font-semibold">{result.strategyUsed === 'native' ? 'Rekonstruksi Vektor Utuh' : 'Deep Page Salvage'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Log Tindakan Perbaikan */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <span>📋</span> Log Tindakan Restorasi ScorpioPDF:
                  </div>
                  <div className="space-y-1 text-[11px] font-mono text-emerald-800">
                    {result.repairLogs.map((log, lIdx) => (
                      <div key={lIdx} className="flex items-start gap-2">
                        <span className="text-rose-600">✓</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Thumbnail Halaman yang Terselamatkan */}
                {result.thumbnails.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-700">
                      Pratinjau Halaman yang Berhasil Diselamatkan:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      {result.thumbnails.map((thumbUrl, tIdx) => (
                        <div
                          key={tIdx}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-2 flex flex-col items-center gap-1.5 shadow-2xs"
                        >
                          <div className="h-32 w-full flex items-center justify-center overflow-hidden rounded bg-white border border-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumbUrl}
                              alt={`Halaman ${tIdx + 1}`}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            Hal. {tIdx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tombol Aksi Hasil */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                  <a
                    href={resultUrl}
                    download={result.fileName}
                    className="inline-flex items-center justify-center gap-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-[0_12px_28px_-6px_rgba(225,29,72,0.48)] transition-all text-sm cursor-pointer"
                  >
                    <span>⬇️</span>
                    Unduh Berkas PDF Pulih Sekarang
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
                    onClick={handleReset}
                    className="inline-flex items-center justify-center gap-2.5 bg-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-700 font-semibold py-3.5 px-5 rounded-2xl border border-slate-200 transition-all text-sm cursor-pointer"
                  >
                    <span>🔄</span>
                    Perbaiki Berkas Lain
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
