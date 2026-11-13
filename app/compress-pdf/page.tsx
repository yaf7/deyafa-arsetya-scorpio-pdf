import type { Metadata } from 'next';
import { CompressPdfWorkspace } from '@/app/components/CompressPdfWorkspace';

export const metadata: Metadata = {
  title: 'Kompres PDF — Perkecil Ukuran File PDF Online | Deyafa Arsetya ScorpioPDF',
  description:
    'Perkecil ukuran dokumen PDF secara drastis hingga 85% untuk upload CPNS, BUMN, email, dan portal kerja. Cepat, aman, dan 100% diproses langsung di browser Anda.',
};

export default function CompressPdfPage() {
  return <CompressPdfWorkspace />;
}

