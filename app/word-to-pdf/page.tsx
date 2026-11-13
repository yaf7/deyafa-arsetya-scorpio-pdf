import type { Metadata } from 'next';
import { WordToPdfWorkspace } from '@/app/components/WordToPdfWorkspace';

export const metadata: Metadata = {
  title: 'WORD ke PDF — Deyafa Arsetya ScorpioPDF',
  description:
    'Konversi dokumen Word DOC dan DOCX menjadi file PDF siap cetak dengan tata letak rapi, tabel, dan gambar yang terjaga langsung di browser di Deyafa Arsetya ScorpioPDF.',
};

export default function WordToPdfPage() {
  return <WordToPdfWorkspace />;
}

