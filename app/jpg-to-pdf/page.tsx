import type { Metadata } from 'next';
import { JpgToPdfWorkspace } from '@/app/components/JpgToPdfWorkspace';

export const metadata: Metadata = {
  title: 'JPG & PNG ke PDF — Deyafa Arsetya ScorpioPDF',
  description:
    'Konversi gambar JPG, JPEG, dan PNG tanpa batas jumlah file menjadi dokumen PDF rapi dengan pengaturan orientasi, ukuran halaman, dan margin di Deyafa Arsetya ScorpioPDF.',
};

export default function JpgToPdfPage() {
  return <JpgToPdfWorkspace />;
}

