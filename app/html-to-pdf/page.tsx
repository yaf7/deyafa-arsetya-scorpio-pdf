import type { Metadata } from 'next';
import { HtmlToPdfWorkspace } from '@/app/components/HtmlToPdfWorkspace';

export const metadata: Metadata = {
  title: 'HTML ke PDF — Konversi Kode & File HTML Jadi Dokumen PDF | Deyafa Arsetya ScorpioPDF',
  description:
    'Konversi kode HTML, invoice bisnis, surat resmi, laporan, atau file .html menjadi dokumen PDF beresolusi tinggi dengan pilihan ukuran kertas A4/F4, margin, dan orientasi.',
};

export default function HtmlToPdfPage() {
  return <HtmlToPdfWorkspace />;
}
