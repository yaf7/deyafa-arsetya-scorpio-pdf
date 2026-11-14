import type { Metadata } from 'next';
import { OrganizePdfWorkspace } from '@/app/components/OrganizePdfWorkspace';

export const metadata: Metadata = {
  title: 'Susun PDF — Tata Ulang, Putar, & Rapikan Halaman PDF | Deyafa Arsetya ScorpioPDF',
  description:
    'Urutkan kembali posisi lembar halaman PDF, balikkan urutan dokumen hasil scan, putar orientasi halaman yang miring, atau duplikasi halaman dengan kontrol visual drag & drop. 100% lokal, cepat, dan aman.',
};

export default function OrganizePdfPage() {
  return <OrganizePdfWorkspace />;
}
