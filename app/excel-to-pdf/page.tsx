import type { Metadata } from 'next';
import { ExcelToPdfWorkspace } from '@/app/components/ExcelToPdfWorkspace';

export const metadata: Metadata = {
  title: 'EXCEL ke PDF (.xlsx ke .pdf) — Deyafa Arsetya ScorpioPDF',
  description:
    'Konversi spreadsheet Excel (.xlsx, .xls, .csv) menjadi laporan PDF rapi, tidak terpotong, dengan orientasi lanskap, ukuran A4 & F4 langsung di browser di Deyafa Arsetya ScorpioPDF.',
};

export default function ExcelToPdfPage() {
  return <ExcelToPdfWorkspace />;
}

