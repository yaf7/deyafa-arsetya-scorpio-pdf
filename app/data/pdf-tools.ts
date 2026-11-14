export type ToolCategoryId =
  | 'organize'
  | 'intelligence'
  | 'optimize'
  | 'convert-to'
  | 'convert-from'
  | 'edit'
  | 'security';

export type ToolAccent =
  | 'coral'
  | 'indigo'
  | 'lime'
  | 'gold'
  | 'blue'
  | 'orange'
  | 'green'
  | 'amber'
  | 'slateBlue'
  | 'plum'
  | 'cobalt';

export interface PdfTool {
  id: string;
  name: string;
  category: ToolCategoryId;
  categoryLabel: string;
  description: string;
  accent: ToolAccent;
  badge?: 'Populer' | 'AI' | 'Baru' | 'Siap Pakai';
  isLive?: boolean;
  featuredInMenu?: boolean;
  workflowSteps: [string, string, string];
}

export interface ToolCategoryMeta {
  id: ToolCategoryId;
  label: string;
  shortLabel: string;
  description: string;
}

export const TOOL_CATEGORIES: ToolCategoryMeta[] = [
  {
    id: 'organize',
    label: 'ATUR PDF',
    shortLabel: 'Atur PDF',
    description:
      'Gabungkan, pisahkan, susun ulang, ekstrak, atau pindai halaman menjadi dokumen rapi.',
  },
  {
    id: 'optimize',
    label: 'OPTIMALKAN PDF',
    shortLabel: 'Optimalkan',
    description:
      'Perkecil ukuran file, perbaiki PDF rusak, dan aktifkan teks yang dapat dicari.',
  },
  {
    id: 'convert-to',
    label: 'KONVERSI KE PDF',
    shortLabel: 'Konversi ke PDF',
    description:
      'Ubah gambar, dokumen Office, dan halaman web menjadi file PDF yang tajam.',
  },
  {
    id: 'convert-from',
    label: 'KONVERSI DARI PDF',
    shortLabel: 'Konversi dari PDF',
    description:
      'Ekspor file PDF kembali ke Word, PowerPoint, Excel, JPG, atau standar arsip PDF/A.',
  },
  {
    id: 'edit',
    label: 'EDIT PDF',
    shortLabel: 'Edit PDF',
    description:
      'Putar, beri nomor halaman, tambah watermark, potong, sunting, dan isi formulir PDF.',
  },
  {
    id: 'security',
    label: 'KEAMANAN PDF',
    shortLabel: 'Keamanan',
    description:
      'Enkripsi, buka kunci, tanda tangani secara digital, sensor, dan bandingkan revisi.',
  },
  {
    id: 'intelligence',
    label: 'KECERDASAN PDF',
    shortLabel: 'Kecerdasan AI',
    description:
      'Ringkas, terjemahkan, dan ubah PDF menjadi format Markdown bersih berbasis AI.',
  },
];

export const PDF_TOOLS: PdfTool[] = [
  // ATUR PDF & INTI POPULER
  {
    id: 'merge-pdf',
    name: 'Gabung PDF',
    category: 'organize',
    categoryLabel: 'ATUR PDF',
    description:
      'Gabungkan beberapa file PDF sesuai urutan yang Anda inginkan dengan mudah dan cepat.',
    accent: 'coral',
    badge: 'Populer',
    featuredInMenu: true,
    workflowSteps: ['Pilih File PDF', 'Atur Urutan', 'Unduh PDF Gabungan'],
    isLive: true,
  },
  {
    id: 'split-pdf',
    name: 'Pisah PDF',
    category: 'organize',
    categoryLabel: 'ATUR PDF',
    description:
      'Pisahkan satu halaman atau rentang halaman tertentu menjadi beberapa file PDF terpisah.',
    accent: 'coral',
    badge: 'Populer',
    workflowSteps: ['Unggah PDF', 'Pilih Rentang Halaman', 'Ekspor File Terpisah'],
    isLive: true,
  },
  {
    id: 'compress-pdf',
    name: 'Kompres PDF',
    category: 'optimize',
    categoryLabel: 'OPTIMALKAN PDF',
    description:
      'Perkecil ukuran file PDF secara drastis dengan tetap menjaga ketajaman teks dan visual.',
    accent: 'lime',
    badge: 'Populer',
    workflowSteps: ['Unggah PDF', 'Pilih Tingkat Kompresi', 'Simpan PDF Ringan'],
    isLive: true,
  },

  // KONVERSI POPULER & FORMAT DOKUMEN
  {
    id: 'pdf-to-word',
    name: 'PDF ke WORD',
    category: 'convert-from',
    categoryLabel: 'KONVERSI DARI PDF',
    description:
      'Konversi dokumen PDF Anda menjadi file Microsoft Word (.docx) yang dapat diedit langsung dengan struktur teks, heading, dan scan otomatis.',
    accent: 'blue',
    badge: 'Siap Pakai',
    isLive: true,
    workflowSteps: ['Pilih File PDF', 'Sesuaikan Mode & Halaman', 'Unduh Dokumen Word (.docx)'],
  },
  {
    id: 'word-to-pdf',
    name: 'WORD ke PDF',
    category: 'convert-to',
    categoryLabel: 'KONVERSI KE PDF',
    description:
      'Ubah dokumen DOC dan DOCX menjadi file PDF siap cetak dengan tata letak rapi, tabel, dan gambar yang terjaga langsung di browser.',
    accent: 'blue',
    badge: 'Siap Pakai',
    isLive: true,
    workflowSteps: ['Pilih Dokumen Word', 'Pratinjau Tata Letak & Ukuran', 'Unduh File PDF'],
  },
  {
    id: 'jpg-to-pdf',
    name: 'JPG/JPEG/PNG ke PDF',
    category: 'convert-to',
    categoryLabel: 'KONVERSI KE PDF',
    description:
      'Ubah gambar JPG, JPEG, dan PNG tanpa batas jumlah file menjadi PDF dengan pengaturan orientasi, ukuran kertas, dan margin.',
    accent: 'gold',
    badge: 'Siap Pakai',
    isLive: true,
    workflowSteps: ['Pilih Gambar JPG/JPEG/PNG', 'Atur Halaman & Margin', 'Unduh File PDF'],
  },
  {
    id: 'pdf-to-jpg',
    name: 'PDF ke JPG/JPEG/PNG',
    category: 'convert-from',
    categoryLabel: 'KONVERSI DARI PDF',
    description:
      'Konversi setiap halaman dokumen PDF menjadi gambar JPG, JPEG, atau PNG resolusi tinggi secara instan dan aman di browser Anda.',
    accent: 'gold',
    badge: 'Siap Pakai',
    isLive: true,
    workflowSteps: ['Pilih Dokumen PDF', 'Pilih Format & Resolusi DPI', 'Unduh Gambar / ZIP'],
  },
  {
    id: 'powerpoint-to-pdf',
    name: 'POWERPOINT ke PDF',
    category: 'convert-to',
    categoryLabel: 'KONVERSI KE PDF',
    description:
      'Konversi presentasi PPTX menjadi dokumen PDF berkualitas tinggi dengan rasio layar 16:9/4:3 asli, A4, atau F4 langsung di browser.',
    accent: 'orange',
    badge: 'Siap Pakai',
    isLive: true,
    workflowSteps: ['Pilih File PowerPoint (.pptx)', 'Pilih Slide & Ukuran Kertas', 'Unduh File PDF'],
  },
  {
    id: 'pdf-to-powerpoint',
    name: 'PDF ke POWERPOINT',
    category: 'convert-from',
    categoryLabel: 'KONVERSI DARI PDF',
    description:
      'Konversi dokumen PDF menjadi slide presentasi Microsoft PowerPoint (.pptx) yang dapat diedit langsung dengan rasio layar lebar atau standar.',
    accent: 'orange',
    badge: 'Siap Pakai',
    isLive: true,
    workflowSteps: ['Pilih File PDF', 'Pilih Mode & Rasio Slide', 'Unduh Presentasi (.pptx)'],
  },
  {
    id: 'excel-to-pdf',
    name: 'EXCEL ke PDF',
    category: 'convert-to',
    categoryLabel: 'KONVERSI KE PDF',
    description:
      'Ubah lembar kerja XLSX, XLS, dan CSV menjadi laporan PDF rapi dengan orientasi lanskap, ukuran A4/F4, dan kolom anti-terpotong.',
    accent: 'green',
    badge: 'Siap Pakai',
    isLive: true,
    workflowSteps: ['Pilih File Excel (.xlsx)', 'Sesuaikan Kertas & Sheet', 'Unduh Laporan PDF'],
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF ke EXCEL',
    category: 'convert-from',
    categoryLabel: 'KONVERSI DARI PDF',
    description:
      'Ekstrak tabel dan data keuangan langsung dari dokumen PDF ke dalam file Microsoft Excel.',
    accent: 'green',
    workflowSteps: ['Unggah PDF', 'Deteksi Tabel', 'Unduh XLSX'],
    isLive: true,
  },
  {
    id: 'html-to-pdf',
    name: 'HTML ke PDF',
    category: 'convert-to',
    categoryLabel: 'KONVERSI KE PDF',
    description:
      'Tangkap halaman web atau kode HTML menjadi dokumen PDF vektor yang tajam dan presisi.',
    accent: 'amber',
    workflowSteps: ['Masukkan URL / HTML', 'Atur Ukuran Layar', 'Ekspor PDF'],
    isLive: true,
  },
  {
    id: 'pdf-to-pdfa',
    name: 'PDF ke PDF/A',
    category: 'convert-from',
    categoryLabel: 'KONVERSI DARI PDF',
    description:
      'Konversi dokumen ke format standar ISO PDF/A untuk pengarsipan legal jangka panjang.',
    accent: 'slateBlue',
    workflowSteps: ['Unggah PDF', 'Pilih Level ISO', 'Unduh PDF/A'],
    isLive: true,
  },

  // SISA ALAT ATUR PDF
  {
    id: 'remove-pages',
    name: 'Hapus Halaman',
    category: 'organize',
    categoryLabel: 'ATUR PDF',
    description:
      'Pilih dan hapus halaman yang tidak diperlukan dari dokumen PDF dalam hitungan detik.',
    accent: 'coral',
    workflowSteps: ['Unggah PDF', 'Tandai Halaman', 'Simpan PDF Bersih'],
    isLive: true,
  },
  {
    id: 'extract-pages',
    name: 'Ekstrak Halaman',
    category: 'organize',
    categoryLabel: 'ATUR PDF',
    description:
      'Ambil halaman tertentu dari dokumen besar untuk membuat file PDF baru yang lebih ringkas.',
    accent: 'coral',
    workflowSteps: ['Unggah PDF', 'Pilih Halaman', 'Ekstrak PDF'],
    isLive: true,
  },
  {
    id: 'organize-pdf',
    name: 'Susun PDF',
    category: 'organize',
    categoryLabel: 'ATUR PDF',
    description:
      'Urutkan, susun ulang, duplikasi, atau hapus halaman dengan kontrol pratinjau thumbnail.',
    accent: 'coral',
    workflowSteps: ['Unggah PDF', 'Atur Thumbnail', 'Terapkan & Simpan'],
    isLive: true,
  },
  {
    id: 'scan-to-pdf',
    name: 'Pindai ke PDF',
    category: 'organize',
    categoryLabel: 'ATUR PDF',
    description:
      'Ubah foto dokumen kertas dari perangkat Anda menjadi file PDF yang tajam dan rapi.',
    accent: 'coral',
    workflowSteps: ['Ambil / Unggah', 'Pertajam Tepi Otomatis', 'Simpan PDF'],
  },

  // SISA ALAT OPTIMALKAN PDF
  {
    id: 'repair-pdf',
    name: 'Perbaiki PDF',
    category: 'optimize',
    categoryLabel: 'OPTIMALKAN PDF',
    description:
      'Pulihkan struktur PDF yang rusak dan selamatkan halaman yang gagal terbuka dengan aman.',
    accent: 'lime',
    workflowSteps: ['Unggah PDF Rusak', 'Bangun Ulang Struktur', 'Pulihkan Dokumen'],
  },
  {
    id: 'ocr-pdf',
    name: 'OCR PDF',
    category: 'optimize',
    categoryLabel: 'OPTIMALKAN PDF',
    description:
      'Kenali teks pada PDF hasil pindaian agar setiap kata dapat dicari dan disalin dengan mudah.',
    accent: 'lime',
    workflowSteps: ['Unggah Hasil Scan', 'Pilih Bahasa Teks', 'Unduh PDF Terindeks'],
  },

  // EDIT PDF
  {
    id: 'rotate-pdf',
    name: 'Putar PDF',
    category: 'edit',
    categoryLabel: 'EDIT PDF',
    description:
      'Perbaiki posisi halaman yang terbalik atau miring secara satuan maupun seluruh dokumen.',
    accent: 'plum',
    workflowSteps: ['Unggah PDF', 'Putar Halaman', 'Simpan Orientasi'],
  },
  {
    id: 'add-page-numbers',
    name: 'Nomor Halaman',
    category: 'edit',
    categoryLabel: 'EDIT PDF',
    description:
      'Sisipkan penomoran halaman yang rapi dengan posisi, jenis huruf, dan nomor awal kustom.',
    accent: 'plum',
    workflowSteps: ['Unggah PDF', 'Atur Gaya Nomor', 'Unduh PDF Bernomor'],
  },
  {
    id: 'add-watermark',
    name: 'Tambah Watermark',
    category: 'edit',
    categoryLabel: 'EDIT PDF',
    description:
      'Bubuhkan tanda air teks atau logo dengan pengaturan transparansi, sudut, dan posisi presisi.',
    accent: 'plum',
    workflowSteps: ['Unggah PDF', 'Rancang Watermark', 'Terapkan & Simpan'],
  },
  {
    id: 'crop-pdf',
    name: 'Potong PDF',
    category: 'edit',
    categoryLabel: 'EDIT PDF',
    description:
      'Pangkas margin berlebih atau fokus pada area halaman tertentu secara seragam di tiap halaman.',
    accent: 'plum',
    workflowSteps: ['Unggah PDF', 'Atur Bingkai Potong', 'Simpan PDF Terpotong'],
  },
  {
    id: 'edit-pdf',
    name: 'Edit PDF',
    category: 'edit',
    categoryLabel: 'EDIT PDF',
    description:
      'Tambahkan teks, sorotan, bentuk, dan anotasi langsung di atas halaman dokumen PDF Anda.',
    accent: 'plum',
    badge: 'Baru',
    workflowSteps: ['Buka Dokumen', 'Anotasi & Sunting', 'Ekspor PDF Terbaru'],
  },
  {
    id: 'pdf-forms',
    name: 'Formulir PDF',
    category: 'edit',
    categoryLabel: 'EDIT PDF',
    description:
      'Buat kolom isian formulir interaktif atau lengkapi formulir PDF yang sudah ada dengan lancar.',
    accent: 'plum',
    workflowSteps: ['Muat Formulir PDF', 'Isi atau Tambah Kolom', 'Simpan Formulir'],
  },

  // KEAMANAN PDF
  {
    id: 'unlock-pdf',
    name: 'Buka Kunci PDF',
    category: 'security',
    categoryLabel: 'KEAMANAN PDF',
    description:
      'Hapus pembatasan kata sandi pada PDF resmi agar dokumen dapat dicetak dan disunting bebas.',
    accent: 'cobalt',
    workflowSteps: ['Unggah PDF Terkunci', 'Verifikasi Izin', 'Simpan PDF Terbuka'],
  },
  {
    id: 'protect-pdf',
    name: 'Lindungi PDF',
    category: 'security',
    categoryLabel: 'KEAMANAN PDF',
    description:
      'Enkripsi file PDF sensitif dengan kata sandi kuat serta kontrol izin akses dokumen.',
    accent: 'cobalt',
    workflowSteps: ['Unggah PDF', 'Atur Kata Sandi Kuat', 'Unduh PDF Terenkripsi'],
  },
  {
    id: 'sign-pdf',
    name: 'Tanda Tangan PDF',
    category: 'security',
    categoryLabel: 'KEAMANAN PDF',
    description:
      'Bubuhkan tanda tangan elektronik secara cepat atau ajukan tanda tangan terverifikasi.',
    accent: 'cobalt',
    workflowSteps: ['Unggah Kontrak', 'Tempatkan Tanda Tangan', 'Unduh PDF Bertanda Tangan'],
  },
  {
    id: 'redact-pdf',
    name: 'Sensor PDF',
    category: 'security',
    categoryLabel: 'KEAMANAN PDF',
    description:
      'Tutup permanen teks, angka, dan elemen grafis rahasia sebelum dokumen dibagikan.',
    accent: 'cobalt',
    workflowSteps: ['Unggah PDF', 'Tandai Bagian Sensitif', 'Terapkan Sensor Permanen'],
  },
  {
    id: 'compare-pdf',
    name: 'Bandingkan PDF',
    category: 'security',
    categoryLabel: 'KEAMANAN PDF',
    description:
      'Sandangkan dua versi dokumen sekaligus dan soroti setiap perbedaan teks maupun visual.',
    accent: 'cobalt',
    workflowSteps: ['Unggah Asli & Revisi', 'Analisis Perbedaan', 'Periksa Perubahan'],
  },

  // KECERDASAN PDF (AI)
  {
    id: 'ai-summarizer',
    name: 'Ringkasan AI',
    category: 'intelligence',
    categoryLabel: 'KECERDASAN PDF',
    description:
      'Saring laporan panjang, jurnal, dan kontrak menjadi poin-poin inti yang jelas secara instan.',
    accent: 'indigo',
    badge: 'AI',
    workflowSteps: ['Unggah Dokumen', 'Pilih Kedalaman Ringkasan', 'Baca Poin Utama'],
  },
  {
    id: 'translate-pdf',
    name: 'Terjemahkan PDF',
    category: 'intelligence',
    categoryLabel: 'KECERDASAN PDF',
    description:
      'Terjemahkan PDF multi-halaman ke berbagai bahasa dengan tata letak dokumen tetap terjaga.',
    accent: 'indigo',
    badge: 'AI',
    workflowSteps: ['Unggah PDF', 'Pilih Bahasa Tujuan', 'Unduh Terjemahan'],
  },
  {
    id: 'pdf-to-markdown',
    name: 'PDF ke Markdown',
    category: 'intelligence',
    categoryLabel: 'KECERDASAN PDF',
    description:
      'Konversi PDF terstruktur menjadi Markdown yang bersih dan siap untuk dokumentasi maupun AI.',
    accent: 'indigo',
    badge: 'AI',
    workflowSteps: ['Unggah PDF', 'Urai Judul & Tabel', 'Salin / Simpan .md'],
  },
];

// Susunan menu dropdown persis mengikuti gambar referensi
export const CONVERT_MENU_COLUMNS = [
  {
    title: 'KONVERSI KE PDF',
    toolIds: [
      'jpg-to-pdf',
      'word-to-pdf',
      'powerpoint-to-pdf',
      'excel-to-pdf',
      'html-to-pdf',
    ],
  },
  {
    title: 'KONVERSI DARI PDF',
    toolIds: [
      'pdf-to-jpg',
      'pdf-to-word',
      'pdf-to-powerpoint',
      'pdf-to-excel',
      'pdf-to-pdfa',
    ],
  },
];

export interface MegaMenuColumn {
  groups: {
    title: string;
    toolIds: string[];
  }[];
}

export const ALL_TOOLS_MENU_COLUMNS: MegaMenuColumn[] = [
  {
    groups: [
      {
        title: 'ATUR PDF',
        toolIds: [
          'merge-pdf',
          'split-pdf',
          'remove-pages',
          'extract-pages',
          'organize-pdf',
          'scan-to-pdf',
        ],
      },
      {
        title: 'KECERDASAN PDF',
        toolIds: ['ai-summarizer', 'translate-pdf', 'pdf-to-markdown'],
      },
    ],
  },
  {
    groups: [
      {
        title: 'OPTIMALKAN PDF',
        toolIds: ['compress-pdf', 'repair-pdf', 'ocr-pdf'],
      },
    ],
  },
  {
    groups: [
      {
        title: 'KONVERSI KE PDF',
        toolIds: [
          'jpg-to-pdf',
          'word-to-pdf',
          'powerpoint-to-pdf',
          'excel-to-pdf',
          'html-to-pdf',
        ],
      },
    ],
  },
  {
    groups: [
      {
        title: 'KONVERSI DARI PDF',
        toolIds: [
          'pdf-to-jpg',
          'pdf-to-word',
          'pdf-to-powerpoint',
          'pdf-to-excel',
          'pdf-to-pdfa',
        ],
      },
    ],
  },
  {
    groups: [
      {
        title: 'EDIT PDF',
        toolIds: [
          'rotate-pdf',
          'add-page-numbers',
          'add-watermark',
          'crop-pdf',
          'edit-pdf',
          'pdf-forms',
        ],
      },
    ],
  },
  {
    groups: [
      {
        title: 'KEAMANAN PDF',
        toolIds: [
          'unlock-pdf',
          'protect-pdf',
          'sign-pdf',
          'redact-pdf',
          'compare-pdf',
        ],
      },
    ],
  },
];

export const TOOL_MAP: Record<string, PdfTool> = Object.fromEntries(
  PDF_TOOLS.map((tool) => [tool.id, tool])
);

export const ACCENT_STYLES: Record<
  ToolAccent,
  {
    borderHover: string;
    glow: string;
    pillBg: string;
    pillText: string;
    primaryHex: string;
    softHex: string;
  }
> = {
  coral: {
    borderHover: 'hover:border-rose-300',
    glow: 'group-hover:shadow-rose-500/10',
    pillBg: 'bg-rose-50',
    pillText: 'text-rose-700',
    primaryHex: '#E84A3C',
    softHex: '#FEE2E2',
  },
  indigo: {
    borderHover: 'hover:border-indigo-300',
    glow: 'group-hover:shadow-indigo-500/10',
    pillBg: 'bg-indigo-50',
    pillText: 'text-indigo-700',
    primaryHex: '#6366F1',
    softHex: '#E0E7FF',
  },
  lime: {
    borderHover: 'hover:border-lime-400',
    glow: 'group-hover:shadow-lime-500/10',
    pillBg: 'bg-lime-50',
    pillText: 'text-lime-700',
    primaryHex: '#73B833',
    softHex: '#ECFCCB',
  },
  gold: {
    borderHover: 'hover:border-yellow-400',
    glow: 'group-hover:shadow-yellow-500/10',
    pillBg: 'bg-yellow-50',
    pillText: 'text-yellow-800',
    primaryHex: '#EAB308',
    softHex: '#FEF9C3',
  },
  blue: {
    borderHover: 'hover:border-blue-300',
    glow: 'group-hover:shadow-blue-500/10',
    pillBg: 'bg-blue-50',
    pillText: 'text-blue-700',
    primaryHex: '#3B7DDD',
    softHex: '#DBEAFE',
  },
  orange: {
    borderHover: 'hover:border-orange-300',
    glow: 'group-hover:shadow-orange-500/10',
    pillBg: 'bg-orange-50',
    pillText: 'text-orange-700',
    primaryHex: '#EC6B45',
    softHex: '#FFEDD5',
  },
  green: {
    borderHover: 'hover:border-emerald-300',
    glow: 'group-hover:shadow-emerald-500/10',
    pillBg: 'bg-emerald-50',
    pillText: 'text-emerald-700',
    primaryHex: '#439E52',
    softHex: '#DCFCE7',
  },
  amber: {
    borderHover: 'hover:border-amber-300',
    glow: 'group-hover:shadow-amber-500/10',
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-800',
    primaryHex: '#E5B217',
    softHex: '#FEF3C7',
  },
  slateBlue: {
    borderHover: 'hover:border-sky-300',
    glow: 'group-hover:shadow-sky-500/10',
    pillBg: 'bg-sky-50',
    pillText: 'text-sky-800',
    primaryHex: '#3A6EA5',
    softHex: '#E0F2FE',
  },
  plum: {
    borderHover: 'hover:border-purple-300',
    glow: 'group-hover:shadow-purple-500/10',
    pillBg: 'bg-purple-50',
    pillText: 'text-purple-700',
    primaryHex: '#9E5499',
    softHex: '#F3E8FF',
  },
  cobalt: {
    borderHover: 'hover:border-blue-300',
    glow: 'group-hover:shadow-blue-500/10',
    pillBg: 'bg-blue-50',
    pillText: 'text-blue-700',
    primaryHex: '#3F72B5',
    softHex: '#DBEAFE',
  },
};
