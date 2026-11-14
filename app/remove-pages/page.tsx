import type { Metadata } from 'next';
import { RemovePagesWorkspace } from '@/app/components/RemovePagesWorkspace';

export const metadata: Metadata = {
  title: 'Hapus Halaman PDF — Buang Halaman yang Tidak Diinginkan | Deyafa Arsetya ScorpioPDF',
  description:
    'Hapus satu atau beberapa halaman yang tidak diinginkan dari dokumen PDF secara visual atau lewat rentang nomor halaman. Cepat, aman, dan 100% lokal tanpa upload ke server.',
};

export default function RemovePagesPage() {
  return <RemovePagesWorkspace />;
}
