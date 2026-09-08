import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const WEBCENTRAL = 'https://weebcentral.com';

type Chapter = {
  id: string;
  title: string;
  url: string;
};

function absoluteUrl(url: string, base: string = WEBCENTRAL): string {
  if (!url) return '';

  try {
    return new URL(url, base).href;
  } catch {
    return '';
  }
}

function getImageSource(
  $: cheerio.CheerioAPI,
  el: any
): string {
  const attrs = [
    'src',
    'data-src',
    'data-lazy-src',
    'data-original',
    'data-url',
    'data-image',
  ];

  for (const attr of attrs) {
    const value = $(el).attr(attr);

    if (
      value &&
      value.trim() &&
      !value.startsWith('data:image')
    ) {
      return value.trim();
    }
  }

  return '';
}

async function fetchWeebCentral(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      Referer: `${WEBCENTRAL}/`,
      ...options.headers,
    },
    cache: 'no-store',
  });
}

async function getManga(seriesUrl: string) {
  const response = await fetchWeebCentral(seriesUrl);

  if (!response.ok) {
    throw new Error(
      `No se pudo cargar el manga. Status: ${response.status}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // ------------------------------------------------------------
  // TÍTULO
  // ------------------------------------------------------------

  let title =
    $('h1').first().text().trim() ||
    $('title').first().text().trim() ||
    'Manga sin título';

  title = title.replace(/\s+/g, ' ').trim();

  // ------------------------------------------------------------
  // PORTADA
  // ------------------------------------------------------------

  let cover = '';

  // Primero intentamos encontrar imágenes que claramente parezcan
  // ser la portada.
  $('img').each((_, el) => {
    if (cover) return;

    const src = getImageSource($, el);

    if (!src) return;

    const absolute = absoluteUrl(src, seriesUrl);

    if (!absolute) return;

    const lower = absolute.toLowerCase();

    if (
      lower.includes('cover') ||
      lower.includes('thumbnail') ||
      lower.includes('/media/')
    ) {
      cover = absolute;
    }
  });

  // Si no encontramos una portada específica, usamos la primera
  // imagen válida de la página.
  if (!cover) {
    $('img').each((_, el) => {
      if (cover) return;

      const src = getImageSource($, el);

      if (!src) return;

      const absolute = absoluteUrl(src, seriesUrl);

      if (!absolute) return;

      cover = absolute;
    });
  }

  // ------------------------------------------------------------
  // SINOPSIS
  // ------------------------------------------------------------

  let synopsis = '';

  const synopsisSelectors = [
    '[class*="description"]',
    '[class*="synopsis"]',
    '[id*="description"]',
    '[id*="synopsis"]',
  ];

  for (const selector of synopsisSelectors) {
    const text = $(selector)
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > 30) {
      synopsis = text;
      break;
    }
  }

  // Fallback: buscar párrafos relativamente largos.
  if (!synopsis) {
    $('p').each((_, el) => {
      if (synopsis) return;

      const text = $(el)
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length > 50) {
        synopsis = text;
      }
    });
  }

        // ------------------------------------------------------------
      // CAPÍTULOS
      // ------------------------------------------------------------

      const chapters: Chapter[] = [];
      const seenUrls = new Set<string>();

      // WeebCentral no muestra todos los capítulos en la página
      // principal del manga. La lista completa está en:
      // /series/{id}/full-chapter-list

      let fullChapterListUrl = '';

      try {
        const parsedSeriesUrl = new URL(seriesUrl);
        const match = parsedSeriesUrl.pathname.match(
          /\/series\/([^/]+)/i
        );

        if (match?.[1]) {
          fullChapterListUrl =
            `${WEBCENTRAL}/series/${match[1]}/full-chapter-list`;
        }
      } catch {
        // Fallback: usamos la URL original si algo falla.
      }

      if (!fullChapterListUrl) {
        fullChapterListUrl =
          `${seriesUrl.replace(/\/$/, '')}/full-chapter-list`;
      }

      try {
        const chaptersResponse =
          await fetchWeebCentral(fullChapterListUrl);

        if (chaptersResponse.ok) {
          const chaptersHtml =
            await chaptersResponse.text();

          const chaptersPage =
            cheerio.load(chaptersHtml);

          chaptersPage(
            'a[href*="/chapters/"]'
          ).each((_, el) => {
            const href =
              chaptersPage(el).attr('href');

            if (!href) return;

            const fullChapterUrl =
              absoluteUrl(
                href,
                fullChapterListUrl
              );

            if (!fullChapterUrl) return;

            if (seenUrls.has(fullChapterUrl)) {
              return;
            }

            seenUrls.add(fullChapterUrl);

            const rawText =
              chaptersPage(el)
                .text()
                .replace(/\s+/g, ' ')
                .trim();

            // --------------------------------------------------------
            // ID ÚNICO DEL CAPÍTULO
            // --------------------------------------------------------

            let chapterId = '';

            try {
              const parsed =
                new URL(fullChapterUrl);

              const match =
                parsed.pathname.match(
                  /\/chapters\/([^/]+)/i
                );

              if (match?.[1]) {
                chapterId = match[1];
              }
            } catch {
              // Fallback abajo.
            }

            if (!chapterId) {
              chapterId = fullChapterUrl;
            }

            // --------------------------------------------------------
            // NOMBRE DEL CAPÍTULO
            // --------------------------------------------------------

            const chapterNumber =
              rawText.match(
                /(?:Chapter|Ch\.?|Episode|Ep\.?)\s*([\d]+(?:\.[\d]+)?)/i
              );

            let chapterTitle = rawText;

            if (chapterNumber?.[1]) {
              chapterTitle =
                `Capítulo ${chapterNumber[1]}`;
            }

            if (!chapterTitle) {
              chapterTitle = 'Capítulo';
            }

            chapters.push({
              id: chapterId,
              title: chapterTitle,
              url: fullChapterUrl,
            });
          });
        }
      } catch (error) {
        console.error(
          'Error cargando lista completa de capítulos:',
          error
        );
      }

      // ------------------------------------------------------------
      // FALLBACK
      // ------------------------------------------------------------

      // Si /full-chapter-list falla, usamos la página principal
      // para no dejar el manga sin capítulos.

      if (chapters.length === 0) {
        $('a[href*="/chapters/"]').each((_, el) => {
          const href = $(el).attr('href');

          if (!href) return;

          const fullChapterUrl =
            absoluteUrl(href, seriesUrl);

          if (!fullChapterUrl) return;

          if (seenUrls.has(fullChapterUrl)) {
            return;
          }

          seenUrls.add(fullChapterUrl);

          const rawText =
            $(el)
              .text()
              .replace(/\s+/g, ' ')
              .trim();

          let chapterId = '';

          try {
            const parsed =
              new URL(fullChapterUrl);

            const match =
              parsed.pathname.match(
                /\/chapters\/([^/]+)/i
              );

            if (match?.[1]) {
              chapterId = match[1];
            }
          } catch {
            // Fallback abajo.
          }

          if (!chapterId) {
            chapterId = fullChapterUrl;
          }

          const chapterNumber =
            rawText.match(
              /(?:Chapter|Ch\.?|Episode|Ep\.?)\s*([\d]+(?:\.[\d]+)?)/i
            );

          let chapterTitle = rawText;

          if (chapterNumber?.[1]) {
            chapterTitle =
              `Capítulo ${chapterNumber[1]}`;
          }

          if (!chapterTitle) {
            chapterTitle = 'Capítulo';
          }

          chapters.push({
            id: chapterId,
            title: chapterTitle,
            url: fullChapterUrl,
          });
        });
      }

  // ------------------------------------------------------------
  // ORDENAR CAPÍTULOS
  // ------------------------------------------------------------

  chapters.sort((a, b) => {
    const getNumber = (title: string) => {
      const match = title.match(
        /(\d+(?:\.\d+)?)/
      );

      return match ? Number(match[1]) : Infinity;
    };

    return getNumber(a.title) - getNumber(b.title);
  });

  return {
    title,
    cover,
    synopsis,
    totalChapters: chapters.length,
    chapters,
  };
}

async function getChapterImages(
  chapterUrl: string
): Promise<string[]> {
  const cleanChapterUrl = chapterUrl.replace(/\/$/, '');

  const imagesUrl = `${cleanChapterUrl}/images`;

  const response = await fetchWeebCentral(imagesUrl);

  if (!response.ok) {
    throw new Error(
      `No se pudieron cargar las imágenes. Status: ${response.status}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const images: string[] = [];
  const seen = new Set<string>();

  $('img').each((_, el) => {
    const src = getImageSource($, el);

    if (!src) return;

    const imageUrl = absoluteUrl(
      src,
      imagesUrl
    );

    if (!imageUrl) return;

    if (seen.has(imageUrl)) return;

    seen.add(imageUrl);
    images.push(imageUrl);
  });

  return images;
}

async function proxyImage(imageUrl: string) {
  if (
    !imageUrl.startsWith('http://') &&
    !imageUrl.startsWith('https://')
  ) {
    return NextResponse.json(
      {
        error: 'URL de imagen inválida',
      },
      {
        status: 400,
      }
    );
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        Referer: `${WEBCENTRAL}/`,
        Accept:
          'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `No se pudo obtener la imagen. Status: ${response.status}`,
        },
        {
          status: response.status,
        }
      );
    }

    const contentType =
      response.headers.get('content-type') ||
      'image/jpeg';

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control':
          'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error(
      'Error al hacer proxy de imagen:',
      error
    );

    return NextResponse.json(
      {
        error: 'Error al obtener la imagen',
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(
  request: Request
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const targetUrl =
      searchParams.get('url');

    const type =
      searchParams.get('type');

    // ----------------------------------------------------------
    // PROXY DE IMAGEN
    // ----------------------------------------------------------

    if (type === 'image') {
      if (!targetUrl) {
        return NextResponse.json(
          {
            error: 'Falta la URL de la imagen',
          },
          {
            status: 400,
          }
        );
      }

      return proxyImage(targetUrl);
    }

    // ----------------------------------------------------------
    // VALIDAR URL
    // ----------------------------------------------------------

    if (!targetUrl) {
      return NextResponse.json(
        {
          error: 'Falta la URL',
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------------------------
    // OBTENER IMÁGENES DE CAPÍTULO
    // ----------------------------------------------------------

    if (type === 'chapter') {
      const images =
        await getChapterImages(targetUrl);

      return NextResponse.json({
        images: images.map(
          (imageUrl) =>
            `/api/manga?type=image&url=${encodeURIComponent(
              imageUrl
            )}`
        ),
      });
    }

    // ----------------------------------------------------------
    // OBTENER INFORMACIÓN DEL MANGA
    // ----------------------------------------------------------

    const cleanUrl = targetUrl.trim();

    const seriesMatch =
      cleanUrl.match(
        /\/series\/([a-zA-Z0-9]+)/
      );

    if (!seriesMatch) {
      return NextResponse.json(
        {
          error:
            'La URL no parece ser una página válida de manga de WeebCentral.',
        },
        {
          status: 400,
        }
      );
    }

    const manga =
      await getManga(cleanUrl);

    // ----------------------------------------------------------
    // PROXY PARA LA PORTADA
    // ----------------------------------------------------------

    const proxiedCover = manga.cover
      ? `/api/manga?type=image&url=${encodeURIComponent(
          manga.cover
        )}`
      : '';

    return NextResponse.json({
      title: manga.title,
      cover: proxiedCover,
      synopsis: manga.synopsis,
      totalChapters:
        manga.totalChapters,
      chapters: manga.chapters,
    });
  } catch (error) {
    console.error(
      'Error en /api/manga:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error desconocido',
      },
      {
        status: 500,
      }
    );
  }
}