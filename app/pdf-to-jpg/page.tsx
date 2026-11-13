import type { Metadata } from 'next';
import { PdfToJpgWorkspace } from '@/app/components/PdfToJpgWorkspace';

export const metadata: Metadata = {
  title: 'PDF ke JPG/JPEG/PNG — Deyafa Arsetya ScorpioPDF',
  description:
    'Konversi setiap halaman file dokumen PDF menjadi gambar JPG, JPEG, atau PNG resolusi tinggi secara instan dan aman langsung di browser di Deyafa Arsetya ScorpioPDF.',
};

export default function PdfToJpgPage() {
  return <PdfToJpgWorkspace />;
}

