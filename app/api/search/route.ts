import { NextResponse } from 'next/server';
import cheerio from 'cheerio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Falta la búsqueda' }, { status: 400 });
  }

  try {
    const searchUrl = `https://weebcentral.com/search/data?author_or_title=${encodeURIComponent(
      query
    )}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: any[] = [];

    // Raspa las tarjetas de resultados
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const title =
        $(el).find('.text-white, font-bold').text().trim() ||
        $(el).text().trim();
      const img = $(el).find('img').attr('src');

      if (href && href.includes('/series/')) {
        results.push({
          title,
          url: href,
          cover: img,
        });
      }
    });

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
