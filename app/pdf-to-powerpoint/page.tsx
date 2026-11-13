import type { Metadata } from 'next';
import { PdfToPowerpointWorkspace } from '@/app/components/PdfToPowerpointWorkspace';

export const metadata: Metadata = {
  title: 'PDF ke POWERPOINT (.pptx) — Deyafa Arsetya ScorpioPDF',
  description:
    'Konversi dokumen PDF menjadi slide presentasi Microsoft PowerPoint (.pptx) yang dapat diedit langsung, akurat, dan aman di peramban tanpa watermark di Deyafa Arsetya ScorpioPDF.',
};

export default function PdfToPowerpointPage() {
  return <PdfToPowerpointWorkspace />;
}

