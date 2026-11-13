import type { Metadata } from 'next';
import { MergePdfWorkspace } from '@/app/components/MergePdfWorkspace';

export const metadata: Metadata = {
  title: 'Gabung PDF — Gabungkan Banyak File PDF Jadi Satu | Deyafa Arsetya ScorpioPDF',
  description:
    'Gabungkan beberapa dokumen PDF sesuai urutan yang Anda inginkan dengan mudah, cepat, dan aman 100% di browser tanpa upload di Deyafa Arsetya ScorpioPDF.',
};

export default function MergePdfPage() {
  return <MergePdfWorkspace />;
}

