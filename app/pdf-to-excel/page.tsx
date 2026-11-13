import type { Metadata } from 'next';
import { PdfToExcelWorkspace } from '@/app/components/PdfToExcelWorkspace';

export const metadata: Metadata = {
  title: 'PDF ke EXCEL (.pdf ke .xlsx & .csv) — Deyafa Arsetya ScorpioPDF',
  description:
    'Ekstrak tabel dan data laporan PDF menjadi spreadsheet Microsoft Excel (.xlsx / .csv) siap hitung rumus dengan deteksi kolom pintar langsung di browser di Deyafa Arsetya ScorpioPDF.',
};

export default function PdfToExcelPage() {
  return <PdfToExcelWorkspace />;
}

