import type { Metadata } from 'next';
import { SplitPdfWorkspace } from '@/app/components/SplitPdfWorkspace';

export const metadata: Metadata = {
  title: 'Pisah PDF — Pisahkan & Ekstrak Halaman PDF Online | Deyafa Arsetya ScorpioPDF',
  description:
    'Pisahkan file PDF menjadi beberapa dokumen terpisah berdasarkan rentang halaman kustom, ekstrak halaman tertentu, atau potong tiap N halaman secara instan, aman, dan 100% di browser.',
};

export default function SplitPdfPage() {
  return <SplitPdfWorkspace />;
}

