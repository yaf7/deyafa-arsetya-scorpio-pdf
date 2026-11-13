import type { Metadata } from 'next';
import { PowerpointToPdfWorkspace } from '@/app/components/PowerpointToPdfWorkspace';

export const metadata: Metadata = {
  title: 'POWERPOINT ke PDF — Deyafa Arsetya ScorpioPDF',
  description:
    'Konversi presentasi PowerPoint (.pptx) menjadi file PDF berkualitas tinggi, rasio 16:9 atau 4:3 asli, dan siap cetak langsung di peramban tanpa watermark di Deyafa Arsetya ScorpioPDF.',
};

export default function PowerpointToPdfPage() {
  return <PowerpointToPdfWorkspace />;
}

