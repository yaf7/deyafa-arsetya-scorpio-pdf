'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_TOOLS_MENU_COLUMNS,
  CONVERT_MENU_COLUMNS,
  PDF_TOOLS,
  TOOL_MAP,
} from '@/app/data/pdf-tools';
import { ScorpioLogo } from './ScorpioLogo';
import { ToolIcon } from './ToolIcon';

interface NavbarProps {
  onResetHome?: () => void;
  onFocusSearch?: () => void;
}

type OpenMenu = 'convert' | 'all' | null;

export function Navbar({ onResetHome, onFocusSearch }: NavbarProps) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);

  const cancelScheduledClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimeoutRef.current = setTimeout(() => {
      setOpenMenu(null);
    }, 150);
  };

  const handleMenuEnter = (menu: OpenMenu) => {
    cancelScheduledClose();
    setOpenMenu(menu);
  };

  const triggerSearch = () => {
    setOpenMenu(null);
    setMobileOpen(false);
    if (onFocusSearch) {
      onFocusSearch();
    } else {
      setQuickQuery('');
      setQuickFindOpen(true);
      setTimeout(() => quickInputRef.current?.focus(), 40);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
        setQuickFindOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpenMenu(null);
        setMobileOpen(false);
        if (onFocusSearch) {
          onFocusSearch();
        } else {
          setQuickQuery('');
          setQuickFindOpen(true);
          setTimeout(() => quickInputRef.current?.focus(), 40);
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      cancelScheduledClose();
    };
  }, [onFocusSearch]);

  const quickResults = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) return PDF_TOOLS.slice(0, 8);
    return PDF_TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [quickQuery]);

  const closeAllMenus = () => {
    setOpenMenu(null);
    setMobileOpen(false);
    setQuickFindOpen(false);
  };

  const isConvertRoute =
    pathname === '/jpg-to-pdf' ||
    pathname === '/word-to-pdf' ||
    pathname === '/powerpoint-to-pdf' ||
    pathname === '/excel-to-pdf' ||
    pathname === '/html-to-pdf' ||
    pathname === '/pdf-to-jpg' ||
    pathname === '/pdf-to-word' ||
    pathname === '/pdf-to-powerpoint' ||
    pathname === '/pdf-to-excel' ||
    pathname === '/pdf-to-pdfa';

  return (
    <>
      <header
        ref={navRef}
        className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur-md"
      >
        <div className="mx-auto flex h-[72px] max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Kiri: Brand + Navigasi Utama */}
          <div className="flex h-full items-center gap-6 xl:gap-8">
            <Link
              href="/"
              onClick={() => {
                closeAllMenus();
                onResetHome?.();
              }}
              className="group rounded-xl py-1 pr-2 text-left transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              aria-label="Beranda Deyafa Arsetya ScorpioPDF"
            >
              <ScorpioLogo size="md" />
            </Link>

            {/* Menu Desktop Utama */}
            <nav
              className="hidden h-full items-center gap-1 lg:flex xl:gap-1.5"
              aria-label="Navigasi Alat PDF Utama"
            >
              <Link
                href="/merge-pdf"
                onClick={closeAllMenus}
                onMouseEnter={() => setOpenMenu(null)}
                className={`rounded-lg px-3 py-2 text-[12.5px] font-bold tracking-[0.04em] uppercase transition-colors ${
                  pathname === '/merge-pdf'
                    ? 'bg-rose-50 text-rose-600'
                    : 'text-slate-800 hover:bg-rose-50/70 hover:text-rose-600'
                }`}
              >
                GABUNG PDF
              </Link>

              <Link
                href="/split-pdf"
                onClick={closeAllMenus}
                onMouseEnter={() => setOpenMenu(null)}
                className={`rounded-lg px-3 py-2 text-[12.5px] font-bold tracking-[0.04em] uppercase transition-colors ${
                  pathname === '/split-pdf'
                    ? 'bg-rose-50 text-rose-600'
                    : 'text-slate-800 hover:bg-rose-50/70 hover:text-rose-600'
                }`}
              >
                PISAH PDF
              </Link>

              <Link
                href="/compress-pdf"
                onClick={closeAllMenus}
                onMouseEnter={() => setOpenMenu(null)}
                className={`rounded-lg px-3 py-2 text-[12.5px] font-bold tracking-[0.04em] uppercase transition-colors ${
                  pathname === '/compress-pdf'
                    ? 'bg-rose-50 text-rose-600'
                    : 'text-slate-800 hover:bg-rose-50/70 hover:text-rose-600'
                }`}
              >
                KOMPRES PDF
              </Link>

              {/* Dropdown Mega-menu KONVERSI PDF */}
              <div
                className="relative flex h-full items-center"
                onMouseEnter={() => handleMenuEnter('convert')}
                onMouseLeave={scheduleClose}
              >
                <button
                  type="button"
                  aria-expanded={openMenu === 'convert'}
                  onClick={() =>
                    setOpenMenu((prev) =>
                      prev === 'convert' ? null : 'convert'
                    )
                  }
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold tracking-[0.04em] uppercase transition-colors ${
                    openMenu === 'convert' || isConvertRoute
                      ? 'bg-rose-50 text-rose-600'
                      : 'text-slate-800 hover:bg-slate-100/80 hover:text-rose-600'
                  }`}
                >
                  <span>KONVERSI PDF</span>
                  <svg
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      openMenu === 'convert'
                        ? 'rotate-180 text-rose-600'
                        : isConvertRoute
                          ? 'text-rose-600'
                          : 'text-slate-500'
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {openMenu === 'convert' && (
                  <div
                    onMouseEnter={cancelScheduledClose}
                    onMouseLeave={scheduleClose}
                    className="absolute top-full left-0 z-50 w-[560px] pt-1.5"
                  >
                    <div className="animate-menu-pop rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_24px_56px_-12px_rgba(15,23,42,0.16)]">
                      <div className="grid grid-cols-2 gap-8">
                        {CONVERT_MENU_COLUMNS.map((col) => (
                          <div key={col.title}>
                            <div className="mb-3.5 text-[11px] font-bold tracking-[0.09em] text-slate-400 uppercase">
                              {col.title}
                            </div>
                            <ul className="space-y-1">
                              {col.toolIds.map((toolId) => {
                                const tool = TOOL_MAP[toolId];
                                if (!tool) return null;
                                const isCurrent = pathname === `/${tool.id}`;
                                return (
                                  <li key={tool.id}>
                                    <Link
                                      href={`/${tool.id}`}
                                      onClick={closeAllMenus}
                                      className={`group flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-all ${
                                        isCurrent
                                          ? 'bg-rose-50/90 text-rose-700'
                                          : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className="flex items-center gap-3">
                                        <span className="shrink-0 transition-transform duration-150 group-hover:scale-105">
                                          <ToolIcon
                                            toolId={tool.id}
                                            accent={tool.accent}
                                            size="sm"
                                          />
                                        </span>
                                        <span
                                          className={`text-[13.5px] font-semibold transition-colors ${
                                            isCurrent
                                              ? 'text-rose-700'
                                              : 'text-slate-700 group-hover:text-slate-950'
                                          }`}
                                        >
                                          {tool.name}
                                        </span>
                                      </span>
                                      {tool.isLive && (
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/80">
                                          Aktif
                                        </span>
                                      )}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dropdown Mega-menu SEMUA ALAT PDF */}
              <div
                className="static flex h-full items-center"
                onMouseEnter={() => handleMenuEnter('all')}
                onMouseLeave={scheduleClose}
              >
                <button
                  type="button"
                  aria-expanded={openMenu === 'all'}
                  onClick={() =>
                    setOpenMenu((prev) => (prev === 'all' ? null : 'all'))
                  }
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold tracking-[0.04em] uppercase transition-colors ${
                    openMenu === 'all'
                      ? 'bg-rose-50 text-rose-600'
                      : 'text-slate-800 hover:bg-slate-100/80 hover:text-rose-600'
                  }`}
                >
                  <span>SEMUA ALAT PDF</span>
                  <svg
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      openMenu === 'all'
                        ? 'rotate-180 text-rose-600'
                        : 'text-slate-500'
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {openMenu === 'all' && (
                  <div
                    onMouseEnter={cancelScheduledClose}
                    onMouseLeave={scheduleClose}
                    className="absolute top-full right-4 left-4 z-50 mx-auto max-w-[1260px] pt-1.5"
                  >
                    <div className="animate-menu-pop rounded-2xl border border-slate-200/90 bg-white px-7 py-7 shadow-[0_28px_70px_-14px_rgba(15,23,42,0.18)]">
                      <div className="grid grid-cols-6 gap-5">
                        {ALL_TOOLS_MENU_COLUMNS.map((col, colIndex) => (
                          <div key={colIndex} className="space-y-6">
                            {col.groups.map((group) => (
                              <div key={group.title}>
                                <div className="mb-3 text-[11px] font-bold tracking-[0.09em] text-slate-400 uppercase">
                                  {group.title}
                                </div>
                                <ul className="space-y-0.5">
                                  {group.toolIds.map((toolId) => {
                                    const tool = TOOL_MAP[toolId];
                                    if (!tool) return null;
                                    const isCurrent = pathname === `/${tool.id}`;
                                    return (
                                      <li key={tool.id}>
                                        <Link
                                          href={`/${tool.id}`}
                                          onClick={closeAllMenus}
                                          className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-all ${
                                            isCurrent
                                              ? 'bg-rose-50/90'
                                              : 'hover:bg-slate-50'
                                          }`}
                                        >
                                          <span className="shrink-0 transition-transform duration-150 group-hover:scale-105">
                                            <ToolIcon
                                              toolId={tool.id}
                                              accent={tool.accent}
                                              size="sm"
                                            />
                                          </span>
                                          <span
                                            className={`truncate text-[13px] font-semibold transition-colors ${
                                              isCurrent || tool.featuredInMenu
                                                ? 'text-rose-600 group-hover:text-rose-700'
                                                : 'text-slate-700 group-hover:text-slate-950'
                                            }`}
                                          >
                                            {tool.name}
                                          </span>
                                          {tool.isLive && (
                                            <span
                                              className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                                              title="Fitur aktif dan siap digunakan"
                                            />
                                          )}
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Kanan: Tombol Pencarian Cepat & Indikator Jumlah Alat */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={triggerSearch}
              className="hidden cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-1.5 text-xs font-medium text-slate-500 transition-all hover:border-slate-300 hover:bg-white hover:text-slate-800 sm:inline-flex"
              aria-label="Cari alat PDF"
            >
              <svg
                className="h-3.5 w-3.5 text-slate-400"
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
              <span>Cari alat...</span>
              <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 xl:inline-block">
                Ctrl K
              </kbd>
            </button>

            <span className="hidden items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50/80 px-3 py-1 text-[11px] font-semibold text-rose-700 md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {PDF_TOOLS.length} Alat
            </span>

            {/* Tombol Menu Mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 lg:hidden"
              aria-label="Buka atau tutup menu navigasi"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="4" x2="20" y1="7" y2="7" />
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="17" y2="17" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Drawer Navigasi Mobile Responsif */}
        {mobileOpen && (
          <div className="max-h-[calc(100vh-72px)] overflow-y-auto border-t border-slate-200 bg-white px-4 py-5 lg:hidden">
            <div className="mb-4 grid grid-cols-3 gap-2">
              {['merge-pdf', 'split-pdf', 'jpg-to-pdf'].map((id) => {
                const t = TOOL_MAP[id];
                if (!t) return null;
                return (
                  <Link
                    key={id}
                    href={`/${t.id}`}
                    onClick={closeAllMenus}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-center text-[11px] font-bold text-slate-800 uppercase transition hover:border-rose-300 hover:bg-rose-50/40"
                  >
                    <ToolIcon toolId={t.id} accent={t.accent} size="sm" />
                    <span>{t.name}</span>
                  </Link>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {ALL_TOOLS_MENU_COLUMNS.flatMap((col) => col.groups).map(
                (group) => (
                  <div key={group.title}>
                    <div className="mb-2 text-[11px] font-bold tracking-[0.09em] text-slate-400 uppercase">
                      {group.title}
                    </div>
                    <div className="grid grid-cols-1 gap-0.5">
                      {group.toolIds.map((toolId) => {
                        const tool = TOOL_MAP[toolId];
                        if (!tool) return null;
                        return (
                          <Link
                            key={tool.id}
                            href={`/${tool.id}`}
                            onClick={closeAllMenus}
                            className="flex items-center justify-between gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                          >
                            <span className="flex items-center gap-2.5">
                              <ToolIcon
                                toolId={tool.id}
                                accent={tool.accent}
                                size="sm"
                              />
                              <span>{tool.name}</span>
                            </span>
                            {tool.isLive && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                Aktif
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </header>

      {/* Palet Pencarian Cepat untuk Halaman Fitur */}
      {quickFindOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 pt-20 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Pencarian cepat alat PDF"
          onClick={() => setQuickFindOpen(false)}
        >
          <div
            className="animate-menu-pop w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
              <svg
                className="h-4.5 w-4.5 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={quickInputRef}
                type="text"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Cari dan lompat ke alat PDF..."
                className="w-full text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuickFindOpen(false)}
                className="cursor-pointer rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
              >
                Esc
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {quickResults.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Tidak ada alat yang cocok dengan &ldquo;{quickQuery}&rdquo;.
                </p>
              ) : (
                quickResults.map((tool) => (
                  <Link
                    key={tool.id}
                    href={`/${tool.id}`}
                    onClick={closeAllMenus}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-3">
                      <ToolIcon
                        toolId={tool.id}
                        accent={tool.accent}
                        size="sm"
                      />
                      <span>
                        <span className="block text-sm font-bold text-slate-900">
                          {tool.name}
                        </span>
                        <span className="block text-[11px] font-semibold text-slate-400">
                          {tool.categoryLabel}
                        </span>
                      </span>
                    </span>
                    {tool.isLive ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                        Siap Pakai
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">
                        Buka →
                      </span>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
