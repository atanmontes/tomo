import { NextResponse } from 'next/server';
import cheerio from 'cheerio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Falta la URL del manga' }, { status: 400 });
  }

  try {
    let cleanUrl = targetUrl.trim();
    const match = cleanUrl.match(/\/series\/([a-zA-Z0-9]+)/);
    if (!match) {
      return NextResponse.json({ error: 'URL de WeebCentral inválida' }, { status: 400 });
    }

    const seriesId = match[1];
    const seriesUrl = `https://weebcentral.com/series/${seriesId}`;
    const fullListUrl = `${seriesUrl}/full-chapter-list`;

    // 1. Obtenemos la página principal de la serie para sacar la portada y la sinopsis
    const seriesRes = await fetch(seriesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
    const seriesHtml = await seriesRes.text();
    const $series = cheerio.load(seriesHtml);

    // Extraemos título, portada y descripción de la serie
    const mangaTitle = $series('h1').first().text().trim() || 'Manga sin título';
    const coverUrl = $series('img').filter((_, el) => {
      const src = $series(el).attr('src') || '';
      return src.includes('cover') || src.includes('media');
    }).first().attr('src') || '';
    
    const synopsis = $series('p').filter((_, el) => $series(el).text().length > 50).first().text().trim() || 'Sin descripción disponible.';

    // 2. Obtenemos la lista completa de capítulos con los headers de HTMX
    const listRes = await fetch(fullListUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'HX-Request': 'true',
        'Accept': 'text/html, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const html = await listRes.text();
    const $ = cheerio.load(html);
    const chapters: { title: string; url: string }[] = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/chapters/')) {
        // Limpiamos el texto basura de WeebCentral ("Chapter X Last Read...")
        let rawText = $(el).text().replace(/\s+/g, ' ').trim();
        
        // Intentamos extraer solo el número del capítulo o formatearlo limpiamente
        const matchNum = rawText.match(/Chapter\s*([\d\.]+)/i);
        const chapterTitle = matchNum ? `Capítulo ${matchNum[1]}` : rawText.replace(/Last Read.*$/i, '').trim();

        const fullChapterUrl = href.startsWith('http') ? href : `https://weebcentral.com${href}`;

        if (!chapters.some((ch) => ch.url === fullChapterUrl)) {
          chapters.push({
            title: chapterTitle || 'Capítulo',
            url: fullChapterUrl,
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      manga: {
        title: mangaTitle,
        cover: coverUrl,
        synopsis: synopsis,
        totalChapters: chapters.length,
      },
      chapters,
    });
  } catch (error: any) {
    console.error("ERROR CRÍTICO:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}