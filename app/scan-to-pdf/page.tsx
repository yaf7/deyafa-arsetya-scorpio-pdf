import type { Metadata } from 'next';
import { ScanToPdfWorkspace } from '@/app/components/ScanToPdfWorkspace';

export const metadata: Metadata = {
  title: 'Pindai ke PDF — CamScanner Online Cerdas & Ubah Foto Jadi PDF | Deyafa Arsetya ScorpioPDF',
  description:
    'Pindai dokumen fisik dengan kamera peramban atau ubah koleksi foto kertas Anda menjadi file PDF tajam dan rapi. Filter Magic Color memutihkan latar kertas kuning/abu-abu dan mempertajam stempel serta tanda tangan. Standar A4, F4/Folio, Letter. 100% lokal & privat.',
};

export default function ScanToPdfPage() {
  return <ScanToPdfWorkspace />;
}
