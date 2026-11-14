import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = body?.url;

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json(
        { error: 'Masukkan tautan URL web yang valid.' },
        { status: 400 }
      );
    }

    let targetUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    // Validasi URL valid
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { error: 'Format tautan URL tidak valid. Contoh: https://example.com' },
        { status: 400 }
      );
    }

    // Ambil konten HTML halaman web
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Gagal mengakses halaman (${response.status} ${response.statusText}). Pastikan URL dapat diakses publik.`,
        },
        { status: response.status }
      );
    }

    let html = await response.text();

    // Dapatkan judul halaman atau hostname untuk nama file default
    let docTitle = parsedUrl.hostname.replace(/[^a-zA-Z0-9_-]/g, '-');
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      const cleanTitle = titleMatch[1]
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .slice(0, 50);
      if (cleanTitle) {
        docTitle = cleanTitle;
      }
    }

    // Sisipkan <base href="..."> agar semua gambar & stylesheet relatif dari domain sumber tetap ter-resolve dengan baik
    const baseHref = `<base href="${targetUrl}">`;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, `$&\n  ${baseHref}`);
    } else {
      html = `${baseHref}\n${html}`;
    }

    return NextResponse.json({
      success: true,
      html,
      title: docTitle,
      url: targetUrl,
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error
        ? err.name === 'TimeoutError'
          ? 'Koneksi ke URL melebihi batas waktu (timeout). Pastikan situs web aktif.'
          : err.message
        : 'Terjadi kesalahan saat memuat halaman web.';

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
