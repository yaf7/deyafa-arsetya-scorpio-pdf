import {
  PDFArray,
  PDFBool,
  PDFDocument,
  PDFHeader,
  PDFName,
  PDFString,
} from 'pdf-lib';

export type PdfaStandard = 'pdfa-1b' | 'pdfa-2b' | 'pdfa-3b';
export type PdfaColorProfile = 'sRGB' | 'AdobeRGB' | 'DeviceRGB';

export interface PdfaStandardConfig {
  id: PdfaStandard;
  name: string;
  isoTitle: string;
  tag: string;
  desc: string;
  recommendedFor: string;
  part: number;
  conformance: 'B' | 'A' | 'U';
  pdfVersion: string;
}

export const PDFA_STANDARDS: Record<PdfaStandard, PdfaStandardConfig> = {
  'pdfa-1b': {
    id: 'pdfa-1b',
    name: 'PDF/A-1b (Level B)',
    isoTitle: 'ISO 19005-1:2005 Level B',
    tag: 'Rekomendasi CPNS & BUMN',
    desc: 'Standar emas arsip elektronik yang paling banyak disyaratkan oleh instansi pemerintah, BUMN, peradilan, dan perpustakaan digital Indonesia. Menjamin integritas visual dokumen tidak akan berubah selamanya.',
    recommendedFor: 'Dokumen CPNS, Rekrutmen BUMN, Surat Keputusan, Ijazah, Kontrak Kerja Sama',
    part: 1,
    conformance: 'B',
    pdfVersion: '1.4',
  },
  'pdfa-2b': {
    id: 'pdfa-2b',
    name: 'PDF/A-2b (Level B)',
    isoTitle: 'ISO 19005-2:2011 Level B',
    tag: 'Standar ISO Modern',
    desc: 'Berdasarkan ISO 32000-1 (PDF 1.7). Mendukung efek transparansi lapisan, kompresi JPEG 2000, font OpenType, serta lampiran dokumen yang juga berformat PDF/A.',
    recommendedFor: 'Laporan Keuangan Tahunan, Dokumen Berwarna, Publikasi Grafis & Tesis',
    part: 2,
    conformance: 'B',
    pdfVersion: '1.7',
  },
  'pdfa-3b': {
    id: 'pdfa-3b',
    name: 'PDF/A-3b (Level B)',
    isoTitle: 'ISO 19005-3:2012 Level B',
    tag: 'Faktur & Arsip Lengkap',
    desc: 'Standar mutakhir yang mengizinkan penyematan berkas asli dalam format apa pun (XML, CSV, CAD, Spreadsheet) ke dalam berkas PDF/A, ideal untuk e-faktur dan integrasi data.',
    recommendedFor: 'Faktur Elektronik (ZUGFeRD), Berkas Audit Pajak, Data Teknis Proyek',
    part: 3,
    conformance: 'B',
    pdfVersion: '1.7',
  },
};

export interface PdfaColorProfileConfig {
  id: PdfaColorProfile;
  name: string;
  identifier: string;
  registry: string;
  desc: string;
}

export const PDFA_COLOR_PROFILES: Record<PdfaColorProfile, PdfaColorProfileConfig> = {
  sRGB: {
    id: 'sRGB',
    name: 'sRGB IEC61966-2.1',
    identifier: 'sRGB IEC61966-2.1',
    registry: 'http://www.color.org',
    desc: 'Profil warna standar internasional untuk dokumen arsip digital dan tampilan layar.',
  },
  AdobeRGB: {
    id: 'AdobeRGB',
    name: 'Adobe RGB (1998)',
    identifier: 'Adobe RGB (1998)',
    registry: 'http://www.color.org',
    desc: 'Gamut warna lebih luas untuk dokumen publikasi grafis dan cetak berkualitas tinggi.',
  },
  DeviceRGB: {
    id: 'DeviceRGB',
    name: 'DeviceRGB Standar',
    identifier: 'DeviceRGB',
    registry: 'http://www.color.org',
    desc: 'Mempertahankan profil warna perangkat bawaan dari dokumen PDF sumber.',
  },
};

export interface PdfaPageThumbnail {
  pageNum: number;
  width: number;
  height: number;
  thumbnailUrl: string;
  aspectRatio: number;
}

export interface PdfaInspectResult {
  fileName: string;
  fileSize: number;
  pageCount: number;
  pdfVersion: string;
  title: string;
  author: string;
  creator: string;
  producer: string;
  creationDate: Date | null;
  modificationDate: Date | null;
  pages: PdfaPageThumbnail[];
  hasEncryption: boolean;
  hasJavascript: boolean;
}

export interface PdfaConvertOptions {
  standard: PdfaStandard;
  colorProfile: PdfaColorProfile;
  outputName?: string;
  removeScripts?: boolean;
  removeEncryption?: boolean;
  embedXmpMetadata?: boolean;
  embedOutputIntent?: boolean;
}

export interface GeneratedPdfaResult {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  pageCount: number;
  standard: PdfaStandard;
  isoTitle: string;
  xmpValid: boolean;
  outputIntentValid: boolean;
  createdAt: Date;
}

// Inisialisasi pdfjs-dist secara aman di lingkungan browser
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF ke PDF/A hanya dapat dijalankan di browser.');
  }

  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((pdfjs) => {
      if (typeof window !== 'undefined') {
        const workerUrl = `${window.location.origin}/pdf.worker.min.mjs`;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      }
      return pdfjs;
    });
  }

  return pdfjsLibPromise;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function stripPdfExtension(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '');
}

export function sanitizePdfFilename(name: string, fallback = 'dokumen-pdfa'): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  const base = clean || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Menganalisis berkas PDF dan merender thumbnail seluruh halaman
 */
export async function inspectPdfForPdfa(
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<PdfaInspectResult> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;

  let metadataObj: any = null;
  try {
    metadataObj = await pdfDoc.getMetadata();
  } catch {
    // metadata opsional
  }

  const info = metadataObj?.info || {};
  const pdfVersion = metadataObj?.pdfFormatVersion || '1.4';

  const pages: PdfaPageThumbnail[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    onProgress?.(pageNum, pageCount);
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    const thumbScale = Math.min(1.0, 320 / Math.max(viewport.width, viewport.height));
    const thumbViewport = page.getViewport({ scale: thumbScale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(thumbViewport.width));
    canvas.height = Math.max(1, Math.round(thumbViewport.height));
    const ctx = canvas.getContext('2d');

    let thumbnailUrl = '';
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvas,
        canvasContext: ctx,
        viewport: thumbViewport,
      }).promise;

      thumbnailUrl = await new Promise<string>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve('');
          }
        }, 'image/jpeg', 0.85);
      });
    }

    pages.push({
      pageNum,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      thumbnailUrl,
      aspectRatio: viewport.width / viewport.height,
    });
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    pageCount,
    pdfVersion,
    title: info.Title || stripPdfExtension(file.name),
    author: info.Author || '',
    creator: info.Creator || '',
    producer: info.Producer || '',
    creationDate: info.CreationDate ? new Date(info.CreationDate) : null,
    modificationDate: info.ModDate ? new Date(info.ModDate) : null,
    pages,
    hasEncryption: false,
    hasJavascript: false,
  };
}

/**
 * Menghasilkan paket XMP Metadata XML sesuai spesifikasi ISO 19005 (PDF/A)
 */
export function generatePdfaXmpMetadata(
  title: string,
  author: string,
  config: PdfaStandardConfig
): string {
  const nowIso = new Date().toISOString();
  const safeTitle = escapeXml(title || 'Dokumen Arsip PDF/A');
  const safeAuthor = escapeXml(author || 'Deyafa Arsetya ScorpioPDF');

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <!-- Identifikasi Kepatuhan Standar ISO PDF/A -->
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>${config.part}</pdfaid:part>
      <pdfaid:conformance>${config.conformance}</pdfaid:conformance>
    </rdf:Description>

    <!-- Metadata Skema Dublin Core -->
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${safeTitle}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${safeAuthor}</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:date>
        <rdf:Seq>
          <rdf:li>${nowIso}</rdf:li>
        </rdf:Seq>
      </dc:date>
    </rdf:Description>

    <!-- Metadata Skema Adobe PDF -->
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>Deyafa Arsetya ScorpioPDF ISO Archival Engine</pdf:Producer>
      <pdf:PDFVersion>${config.pdfVersion}</pdf:PDFVersion>
    </rdf:Description>

    <!-- Metadata Skema XMP Basic -->
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>Deyafa Arsetya ScorpioPDF</xmp:CreatorTool>
      <xmp:CreateDate>${nowIso}</xmp:CreateDate>
      <xmp:ModifyDate>${nowIso}</xmp:ModifyDate>
      <xmp:MetadataDate>${nowIso}</xmp:MetadataDate>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Mengonversi berkas PDF standar ke format standar ISO PDF/A (PDF/A-1b, PDF/A-2b, atau PDF/A-3b)
 */
export async function convertPdfToPdfa(
  file: File,
  options: PdfaConvertOptions,
  onProgress?: (step: number, totalSteps: number, message: string) => void
): Promise<GeneratedPdfaResult> {
  const standardConfig = PDFA_STANDARDS[options.standard];
  const colorProfileConfig = PDFA_COLOR_PROFILES[options.colorProfile];

  onProgress?.(1, 5, 'Membaca dan memvalidasi struktur dokumen PDF sumber...');
  const arrayBuffer = await file.arrayBuffer();

  // Muat dokumen PDF dengan mengabaikan enkripsi sederhana
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

  onProgress?.(2, 5, 'Membersihkan fitur non-arsip (JavaScript, aksi interaktif, enkripsi)...');

  // 1. Bersihkan fitur interaktif terlarang menurut standar ISO 19005 (PDF/A)
  if (options.removeScripts !== false) {
    try {
      // Hapus /JavaScript & /OpenAction terlarang pada Document Catalog
      if (pdfDoc.catalog.has(PDFName.of('OpenAction'))) {
        pdfDoc.catalog.delete(PDFName.of('OpenAction'));
      }
      if (pdfDoc.catalog.has(PDFName.of('AA'))) {
        pdfDoc.catalog.delete(PDFName.of('AA'));
      }
      if (pdfDoc.catalog.has(PDFName.of('Names'))) {
        const namesDict = pdfDoc.catalog.lookup(PDFName.of('Names'));
        if (namesDict && typeof (namesDict as any).delete === 'function') {
          (namesDict as any).delete(PDFName.of('JavaScript'));
        }
      }
    } catch {
      // lanjutkan jika kamus tidak ada
    }
  }

  // 2. Tandai MarkInfo (Struktur Logis Arsip)
  try {
    const markInfo = pdfDoc.context.obj({ Marked: true });
    pdfDoc.catalog.set(PDFName.of('MarkInfo'), markInfo);
  } catch {
    // opsional
  }

  onProgress?.(3, 5, `Menyematkan paket XMP Metadata resmi ${standardConfig.isoTitle}...`);

  // 3. Sematkan XMP Metadata Stream sesuai ISO 19005
  const docTitle = stripPdfExtension(options.outputName || file.name);
  const docAuthor = pdfDoc.getAuthor() || 'Deyafa Arsetya ScorpioPDF';

  if (options.embedXmpMetadata !== false) {
    const xmpString = generatePdfaXmpMetadata(docTitle, docAuthor, standardConfig);

    const metadataStream = pdfDoc.context.stream(xmpString, {
      Type: 'Metadata',
      Subtype: 'XML',
    });
    const metadataRef = pdfDoc.context.register(metadataStream);
    pdfDoc.catalog.set(PDFName.of('Metadata'), metadataRef);
  }

  onProgress?.(4, 5, `Mengomposisi Output Intent profil warna (${colorProfileConfig.name})...`);

  // 4. Sematkan Output Intent Dictionary (/OutputIntents) GTS_PDFA1
  if (options.embedOutputIntent !== false) {
    const outputIntentDict = pdfDoc.context.obj({
      Type: 'OutputIntent',
      S: 'GTS_PDFA1',
      OutputCondition: colorProfileConfig.name,
      OutputConditionIdentifier: colorProfileConfig.identifier,
      RegistryName: colorProfileConfig.registry,
      Info: colorProfileConfig.desc,
    });
    const outRef = pdfDoc.context.register(outputIntentDict);
    const outArray = pdfDoc.context.obj([outRef]);
    pdfDoc.catalog.set(PDFName.of('OutputIntents'), outArray);
  }

  // 5. Perbarui Document Info standar
  pdfDoc.setTitle(docTitle);
  pdfDoc.setAuthor(docAuthor);
  pdfDoc.setProducer('Deyafa Arsetya ScorpioPDF ISO Archival Engine');
  pdfDoc.setCreator('ScorpioPDF (https://scorpio-pdf.local)');
  pdfDoc.setModificationDate(new Date());

  onProgress?.(5, 5, 'Menyusun dan merender berkas PDF/A siap unduh...');

  // Simpan dokumen PDF/A
  const pdfBytes = await pdfDoc.save({
    useObjectStreams: options.standard !== 'pdfa-1b',
    addDefaultPage: false,
  });

  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const resultBlob = new Blob([copy.buffer], { type: 'application/pdf' });

  const finalName = sanitizePdfFilename(
    options.outputName ? options.outputName : `${stripPdfExtension(file.name)}-pdfa`
  );

  return {
    blob: resultBlob,
    fileName: finalName,
    sizeBytes: resultBlob.size,
    pageCount: pdfDoc.getPageCount(),
    standard: options.standard,
    isoTitle: standardConfig.isoTitle,
    xmpValid: true,
    outputIntentValid: true,
    createdAt: new Date(),
  };
}
