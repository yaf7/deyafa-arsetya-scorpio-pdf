import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/app/components/Navbar';
import { ScorpioLogo } from '@/app/components/ScorpioLogo';
import { ToolIcon } from '@/app/components/ToolIcon';
import {
  ACCENT_STYLES,
  PDF_TOOLS,
  TOOL_MAP,
} from '@/app/data/pdf-tools';

type ToolRouteProps = {
  params: Promise<{ toolId: string }>;
};

export function generateStaticParams() {
  return PDF_TOOLS.filter((tool) => tool.id !== 'jpg-to-pdf').map((tool) => ({
    toolId: tool.id,
  }));
}

export async function generateMetadata({
  params,
}: ToolRouteProps): Promise<Metadata> {
  const { toolId } = await params;
  const tool = TOOL_MAP[toolId];
  if (!tool) {
    return {
      title: 'Alat Tidak Ditemukan — Deyafa Arsetya ScorpioPDF',
    };
  }
  return {
    title: `${tool.name} — Deyafa Arsetya ScorpioPDF`,
    description: tool.description,
  };
}

export default async function ToolDetailPage({ params }: ToolRouteProps) {
  const { toolId } = await params;
  const tool = TOOL_MAP[toolId];

  if (!tool) {
    notFound();
  }

  const accent = ACCENT_STYLES[tool.accent];
  const relatedTools = PDF_TOOLS.filter(
    (item) => item.category === tool.category && item.id !== tool.id
  );

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F8F9FC] text-slate-900">
      <div
        className="bg-dot-grid pointer-events-none fixed inset-0 z-0 opacity-75"
        aria-hidden="true"
      />

      <Navbar />

      <main className="relative z-10 mx-auto flex w-full max-w-[1160px] flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
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
          <span className="text-slate-400">{tool.categoryLabel}</span>
          <span>/</span>
          <span className="font-bold text-slate-800">{tool.name}</span>
        </div>

        {/* Kartu Ruang Kerja Fitur */}
        <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08)]">
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: accent.primaryHex }}
          />

          <div className="p-7 sm:p-10">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-2xs">
                  <ToolIcon toolId={tool.id} accent={tool.accent} size="lg" />
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-0.5 text-[10.5px] font-bold tracking-[0.08em] uppercase ${accent.pillBg} ${accent.pillText}`}
                    >
                      {tool.categoryLabel}
                    </span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-0.5 text-[10.5px] font-bold text-amber-800">
                      Tahap Pengembangan Berikutnya
                    </span>
                  </div>
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                    {tool.name}
                  </h1>
                </div>
              </div>

              <Link
                href="/jpg-to-pdf"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
              >
                <span>Coba JPG &amp; PNG ke PDF (Sudah Aktif)</span>
                <span>→</span>
              </Link>
            </div>

            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-600">
              {tool.description}
            </p>

            {/* Area Pratinjau Ruang Kerja yang Direncanakan */}
            <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/75 p-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-xs ring-1 ring-slate-200/80">
                <svg
                  className="h-7 w-7"
                  style={{ color: accent.primaryHex }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 16V4m0 0-4 4m4-4 4 4" />
                  <path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
                </svg>
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Halaman Khusus {tool.name} — Segera Hadir
              </h2>
              <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-slate-500">
                Halaman ini sudah disiapkan khusus untuk fitur{' '}
                <strong className="font-semibold text-slate-700">
                  {tool.name}
                </strong>{' '}
                di Deyafa Arsetya ScorpioPDF. Mesin pemrosesan dokumen akan
                segera diaktifkan mengikuti alur 3 langkah berikut:
              </p>

              <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
                {tool.workflowSteps.map((step, idx) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: accent.primaryHex }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alat Terkait dalam Kategori yang Sama */}
            {relatedTools.length > 0 && (
              <div className="mt-8 border-t border-slate-100 pt-7">
                <h3 className="mb-3 text-xs font-bold tracking-[0.09em] text-slate-400 uppercase">
                  Fitur Lainnya di {tool.categoryLabel}
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                  {relatedTools.map((rel) => (
                    <Link
                      key={rel.id}
                      href={`/${rel.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/50 px-3.5 py-2.5 transition hover:border-slate-300 hover:bg-white"
                    >
                      <span className="flex items-center gap-2.5">
                        <ToolIcon
                          toolId={rel.id}
                          accent={rel.accent}
                          size="sm"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          {rel.name}
                        </span>
                      </span>
                      {rel.isLive ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Aktif
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">→</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-200/80 bg-white py-6">
        <div className="mx-auto flex max-w-[1160px] flex-col items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <ScorpioLogo size="sm" showOwnerLine={false} />
          <span>&copy; 2026 Deyafa Arsetya ScorpioPDF</span>
        </div>
      </footer>
    </div>
  );
}

