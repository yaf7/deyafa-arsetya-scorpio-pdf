import type { Metadata } from 'next';
import { PdfToWordWorkspace } from '@/app/components/PdfToWordWorkspace';

export const metadata: Metadata = {
  title: 'PDF ke WORD (.docx) — Deyafa Arsetya ScorpioPDF',
  description:
    'Konversi dokumen PDF menjadi file Microsoft Word (.docx) yang dapat diedit langsung secara gratis, cepat, dan aman 100% di browser tanpa upload di Deyafa Arsetya ScorpioPDF.',
};

export default function PdfToWordPage() {
  return <PdfToWordWorkspace />;
}

