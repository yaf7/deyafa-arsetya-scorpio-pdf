'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import {
  ACCENT_STYLES,
  PDF_TOOLS,
  TOOL_CATEGORIES,
  ToolCategoryId,
} from '@/app/data/pdf-tools';
import { Navbar } from './Navbar';
import { ScorpioLogo } from './ScorpioLogo';
import { ToolIcon } from './ToolIcon';

type FilterValue = 'all' | ToolCategoryId;

export function HomeShowcase() {
  const [activeCategory, setActiveCategory] = useState<FilterValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return PDF_TOOLS.filter((tool) => {
      const matchesCat =
        activeCategory === 'all' || tool.category === activeCategory;
      const matchesQuery =
        q === '' ||
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.categoryLabel.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [activeCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<ToolCategoryId, number> = {
      organize: 0,
      optimize: 0,
      'convert-to': 0,
      'convert-from': 0,
      edit: 0,
      security: 0,
      intelligence: 0,
    };
    for (const tool of PDF_TOOLS) {
      counts[tool.category] += 1;
    }
    return counts;
  }, []);

  const handleResetHome = () => {
    setActiveCategory('all');
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFocusSearch = () => {
    searchInputRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 220);
  };

  const isUnfilteredAll =
    activeCategory === 'all' && searchQuery.trim() === '';

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F8F9FC] text-slate-900">
      {/* Latar Belakang Arsitektural Halus */}
      <div
        className="bg-dot-grid pointer-events-none fixed inset-0 z-0 opacity-75"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[520px] bg-[radial-gradient(ellipse_75%_55%_at_50%_-10%,rgba(225,29,72,0.10),rgba(99,102,241,0.05)_50%,transparent_80%)]"
        aria-hidden="true"
      />

      {/* Header Atas Sticky */}
      <Navbar
        onResetHome={handleResetHome}
        onFocusSearch={handleFocusSearch}
      />

      <main className="relative z-10 flex-1">
        {/* Bagian Hero */}
        <section className="mx-auto max-w-[1380px] px-4 pt-10 pb-6 sm:px-6 md:pt-14 md:pb-8 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-200/90 bg-white/90 px-3.5 py-1.5 text-[11.5px] font-bold tracking-[0.14em] text-rose-700 uppercase shadow-[0_2px_10px_rgba(225,29,72,0.08)] backdrop-blur-xs">
              <svg
                className="h-3.5 w-3.5 text-rose-600"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z" />
              </svg>
              <span>Deyafa Arsetya • Rangkaian ScorpioPDF</span>
            </div>

            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl sm:leading-[1.12]">
              Semua alat untuk{' '}
              <span className="bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 bg-clip-text text-transparent">
                mengolah PDF
              </span>
              , dalam satu tempat yang elegan.
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600 sm:text-base">
              Gabungkan, pisahkan, kompres, konversi, edit, amankan, dan
              analisis dokumen Anda dengan presisi. Setiap fitur memiliki
              halaman khusus di{' '}
              <span className="font-semibold text-slate-800">
                Deyafa Arsetya ScorpioPDF
              </span>
              .
            </p>
          </div>

          {/* Kontrol Pencarian & Filter Kategori */}
          <div className="mx-auto mt-8 max-w-5xl space-y-4">
            <div className="relative mx-auto max-w-xl">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                <svg
                  className="h-4.5 w-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari 33 alat PDF — JPG/JPEG/PNG ke PDF, Gabung, OCR, Ringkasan AI..."
                aria-label="Cari alat PDF"
                className="w-full rounded-2xl border border-slate-200/95 bg-white py-3.5 pr-11 pl-11 text-sm font-medium text-slate-900 shadow-[0_6px_24px_-6px_rgba(15,23,42,0.07)] transition-all placeholder:text-slate-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-3 my-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Hapus pencarian"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Pil Filter Kategori */}
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              role="tablist"
              aria-label="Filter alat PDF berdasarkan kategori"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === 'all'}
                onClick={() => setActiveCategory('all')}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'border border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <span>Semua Alat</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10.5px] leading-none ${
                    activeCategory === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {PDF_TOOLS.length}
                </span>
              </button>

              {TOOL_CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-rose-600 text-white shadow-[0_4px_14px_rgba(225,29,72,0.28)]'
                        : 'border border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <span>{cat.shortLabel}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10.5px] leading-none ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {categoryCounts[cat.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Grid Alat Utama */}
        <section className="mx-auto max-w-[1380px] px-4 pt-2 pb-14 sm:px-6 lg:px-8">
          {filteredTools.length === 0 ? (
            <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xs">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Alat tidak ditemukan
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Kami tidak menemukan alat PDF yang cocok dengan kata kunci
                &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
                className="mt-5 cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-600"
              >
                Tampilkan Semua 33 Alat
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTools.map((tool) => {
                const accent = ACCENT_STYLES[tool.accent];
                return (
                  <Link
                    key={tool.id}
                    href={`/${tool.id}`}
                    className={`group relative flex h-full flex-col items-start rounded-2xl border bg-white p-5.5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.025)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_36px_-12px_rgba(15,23,42,0.12)] ${
                      tool.isLive
                        ? 'border-amber-300/90 ring-1 ring-amber-200/60'
                        : 'border-slate-200/85'
                    } ${accent.borderHover} ${accent.glow}`}
                  >
                    {/* Bagian Atas Kartu: Ikon + Lencana */}
                    <div className="flex w-full items-start justify-between gap-3">
                      <div className="rounded-xl bg-slate-50/90 p-1.5 ring-1 ring-slate-100 transition-transform duration-200 group-hover:scale-105">
                        <ToolIcon
                          toolId={tool.id}
                          accent={tool.accent}
                          size="md"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {tool.badge && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold tracking-wide ${
                              tool.badge === 'Siap Pakai'
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/90'
                                : tool.badge === 'AI'
                                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70'
                                  : tool.badge === 'Baru'
                                    ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200/70'
                                    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/70'
                            }`}
                          >
                            {tool.badge}
                          </span>
                        )}
                        <span className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:bg-slate-100 group-hover:text-slate-700">
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14m-6-6 6 6-6 6" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {/* Judul & Deskripsi */}
                    <div className="mt-4 w-full">
                      <div className="mb-1 text-[10px] font-bold tracking-[0.09em] text-slate-400 uppercase">
                        {tool.categoryLabel}
                      </div>
                      <h2 className="font-display text-[17.5px] font-bold tracking-tight text-slate-900 transition-colors group-hover:text-slate-950">
                        {tool.name}
                      </h2>
                      <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-slate-500">
                        {tool.description}
                      </p>
                    </div>
                  </Link>
                );
              })}

              {/* Kartu Aksen Rangkaian Fitur Mendatang */}
              {isUnfilteredAll && (
                <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-rose-200/70 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950 p-6 text-white shadow-[0_18px_40px_-14px_rgba(15,23,42,0.35)] sm:col-span-1 lg:col-span-3 xl:col-span-3">
                  <div
                    className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-rose-500/20 blur-3xl"
                    aria-hidden="true"
                  />
                  <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
                    <div className="max-w-xl">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[10.5px] font-bold tracking-[0.12em] text-emerald-200 uppercase">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        JPG/JPEG/PNG ke PDF &amp; PDF ke JPG/JPEG/PNG Siap Pakai
                      </span>
                      <h3 className="font-display mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
                        Konversi Gambar &amp; PDF Dua Arah Tanpa Batas
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">
                        Fitur{' '}
                        <strong className="font-semibold text-white">
                          JPG/JPEG/PNG ke PDF
                        </strong>{' '}
                        dan{' '}
                        <strong className="font-semibold text-white">
                          PDF ke JPG/JPEG/PNG
                        </strong>{' '}
                        sudah aktif penuh. Konversi gambar apa pun ke dokumen PDF atau
                        ekstrak halaman PDF menjadi gambar resolusi tinggi (hingga 300 DPI)
                        langsung di browser Anda.
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2.5">
                      <Link
                        href="/pdf-to-jpg"
                        className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold tracking-wide text-slate-950 shadow-sm transition hover:bg-amber-400"
                      >
                        Buka PDF ke JPG/JPEG/PNG →
                      </Link>
                      <Link
                        href="/jpg-to-pdf"
                        className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold tracking-wide text-white shadow-sm transition hover:bg-rose-500"
                      >
                        Buka JPG/JPEG/PNG ke PDF →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Keunggulan Ruang Kerja ScorpioPDF */}
        <section className="border-t border-slate-200/80 bg-white/80 py-14 backdrop-blur-xs">
          <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-[11px] font-bold tracking-[0.14em] text-rose-600 uppercase">
                  Dirancang untuk Kecepatan &amp; Ketajaman
                </p>
                <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Standar Ruang Kerja ScorpioPDF
                </h2>
              </div>
              <p className="max-w-md text-sm text-slate-500">
                Tersusun rapi dalam 7 kategori khusus agar setiap pekerjaan
                dokumen terasa cepat, jelas, dan nyaman.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Presisi Format Lengkap
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  Alur kerja dua arah yang mulus antara PDF, Word, PowerPoint,
                  Excel, JPG, PNG, HTML, hingga format arsip standar PDF/A.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                  </svg>
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Kecerdasan AI Scorpio
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  Dilengkapi Ringkasan AI, Penerjemah PDF yang menjaga tata
                  letak, serta ekstraksi PDF ke Markdown yang bersih.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Kendali Keamanan Menyeluruh
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  Enkripsi, buka kunci, tanda tangan elektronik, sensor
                  permanen, serta perbandingan revisi dokumen dalam satu aplikasi.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Rapi */}
      <footer className="relative z-10 border-t border-slate-200/90 bg-white py-10">
        <div className="mx-auto flex max-w-[1380px] flex-col justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <ScorpioLogo size="sm" />
            <p className="mt-2.5 max-w-sm text-xs leading-relaxed text-slate-500">
              Deyafa Arsetya ScorpioPDF — Perangkat alat PDF modern dan estetik
              yang dirancang untuk kemudahan pengaturan, konversi, penyuntingan,
              serta kecerdasan dokumen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
            {TOOL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="cursor-pointer transition-colors hover:text-rose-600"
              >
                {cat.shortLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-8 flex max-w-[1380px] flex-col justify-between gap-2 border-t border-slate-100 px-4 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <span>
            &copy; 2026 Deyafa Arsetya ScorpioPDF. Hak cipta dilindungi.
          </span>
          <span>33 Halaman Fitur PDF • Konversi Gambar &amp; PDF Siap Pakai</span>
        </div>
      </footer>
    </div>
  );
}
