import type { Metadata } from 'next';
import { PdfToPdfaWorkspace } from '@/app/components/PdfToPdfaWorkspace';

export const metadata: Metadata = {
  title: 'PDF ke PDF/A — Standar Arsip Digital ISO CPNS & BUMN | Deyafa Arsetya ScorpioPDF',
  description:
    'Konversi dokumen PDF ke format standar ISO PDF/A (PDF/A-1b, PDF/A-2b, PDF/A-3b) untuk pengarsipan resmi CPNS, rekrutmen BUMN, instansi pemerintah, dan peradilan Indonesia.',
};

export default function PdfToPdfaPage() {
  return <PdfToPdfaWorkspace />;
}
