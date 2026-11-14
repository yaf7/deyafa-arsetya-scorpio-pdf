import type { Metadata } from 'next';
import { ExtractPagesWorkspace } from '@/app/components/ExtractPagesWorkspace';

export const metadata: Metadata = {
  title: 'Ekstrak Halaman PDF — Ambil & Pisahkan Halaman PDF | Deyafa Arsetya ScorpioPDF',
  description:
    'Ambil halaman tertentu dari dokumen PDF besar. Gabungkan menjadi satu PDF baru atau unduh tiap halaman secara terpisah dalam berkas ZIP. 100% lokal, cepat, dan aman.',
};

export default function ExtractPagesPage() {
  return <ExtractPagesWorkspace />;
}
