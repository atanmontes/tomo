import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Falta la URL' }, { status: 400 });
    }

    // Petición con User-Agent para evitar bloqueo de WeebCentral en Render
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-MX,es;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al conectar con la página: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Ajusta las etiquetas según cómo estructure WeebCentral el título y la portada
    const title = $('h1').first().text().trim() || 'Manga sin título';
    const cover = $('img.cover-image, .manga-poster img, meta[property="og:image"]').attr('content') || $('img').first().attr('src') || '';

    return NextResponse.json({
      manga: {
        title,
        cover,
      },
    });
  } catch (error: any) {
    console.error('Error en scraper:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el manga' }, { status: 500 });
  }
}