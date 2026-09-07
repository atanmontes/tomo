import { NextResponse } from 'next/server';
import cheerio from 'cheerio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Falta la URL' }, { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const html = await res.text();
    const $ = cheerio.load(html);
    const images: string[] = [];

    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (
        src &&
        (src.includes('cdn') ||
          src.includes('/manga/') ||
          src.includes('weebcentral'))
      ) {
        images.push(src);
      }
    });

    return NextResponse.json({ success: true, count: images.length, images });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
