import type { Metadata } from 'next';
import { RepairPdfWorkspace } from '@/app/components/RepairPdfWorkspace';

export const metadata: Metadata = {
  title: 'Perbaiki PDF — Pulihkan File PDF Rusak & Selamatkan Halaman | Deyafa Arsetya ScorpioPDF',
  description:
    'Pulihkan dokumen PDF yang rusak, tidak bisa dibuka, atau terpotong saat diunduh. Rekonstruksi tabel XRef, perbaikan header biner, penambalan penanda %%EOF, dan penyelamatan halaman darurat. 100% lokal & privat di peramban Anda.',
};

export default function RepairPdfPage() {
  return <RepairPdfWorkspace />;
}
