import { NextResponse } from 'next/server';

const CONNECTOR_URL =
  process.env.TOMO_CONNECTOR_URL ||
  'http://127.0.0.1:3001';

const WEBCENTRAL_HOSTS = [
  'weebcentral.com',
  'www.weebcentral.com',
];

const IMAGE_HOSTS = [
  'official.lowee.us',
  'temp.compsci88.com',
  'scans.lastation.us',
  'hot.planeptune.us',
];

type Chapter = {
  id: string;
  title: string;
  url: string;
};

type ConnectorMangaResponse = {
  success: boolean;
  seriesId: string;
  title: string;
  cover: string;
  synopsis: string;
  source?: string;
  url?: string;
  pageBytes?: number;
  hasPageContent?: boolean;
  error?: string;
  details?: string;
};

type ConnectorChaptersResponse = {
  success: boolean;
  seriesId: string;
  totalChapters: number;
  chapters: Chapter[];
  error?: string;
  details?: string;
};

type ConnectorChapterResponse = {
  success: boolean;
  chapterId: string;
  chapterUrl: string;
  totalImages: number;
  images: string[];
  error?: string;
  details?: string;
};

// ============================================================
// CONECTOR
// ============================================================

async function connectorFetch<T>(
  path: string
): Promise<T> {
  const response = await fetch(
    `${CONNECTOR_URL}${path}`,
    {
      method: 'GET',
      cache: 'no-store',
    }
  );

  const text = await response.text();

  let data: T;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `El connector devolvió una respuesta inválida. Status: ${response.status}`
    );
  }

  if (!response.ok) {
    const errorData = data as {
      error?: string;
      details?: string;
    };

    throw new Error(
      errorData.details ||
        errorData.error ||
        `El connector respondió HTTP ${response.status}`
    );
  }

  return data;
}

// ============================================================
// VALIDAR URL DE WEBCENTRAL
// ============================================================

function isValidWeebCentralUrl(
  value: string
): boolean {
  try {
    const parsed = new URL(value);

    return WEBCENTRAL_HOSTS.includes(
      parsed.hostname.toLowerCase()
    );
  } catch {
    return false;
  }
}

// ============================================================
// OBTENER SERIES ID
// ============================================================

function getSeriesId(
  seriesUrl: string
): string {
  try {
    const parsed = new URL(seriesUrl);

    const match =
      parsed.pathname.match(
        /\/series\/([A-Z0-9]{26})/i
      );

    return match?.[1] || '';
  } catch {
    return '';
  }
}

// ============================================================
// OBTENER CHAPTER ID
// ============================================================

function getChapterId(
  chapterUrl: string
): string {
  try {
    const parsed = new URL(chapterUrl);

    const match =
      parsed.pathname.match(
        /\/chapters\/([A-Z0-9]{26})/i
      );

    return match?.[1] || '';
  } catch {
    return '';
  }
}

// ============================================================
// PROXY DE IMAGEN
// ============================================================

async function proxyImage(
  imageUrl: string
) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json(
      {
        error: 'URL de imagen inválida',
      },
      {
        status: 400,
      }
    );
  }

  if (
    parsedUrl.protocol !== 'https:'
  ) {
    return NextResponse.json(
      {
        error:
          'La imagen debe utilizar HTTPS',
      },
      {
        status: 400,
      }
    );
  }

  if (
    !IMAGE_HOSTS.includes(
      parsedUrl.hostname.toLowerCase()
    )
  ) {
    return NextResponse.json(
      {
        error:
          'El dominio de la imagen no está permitido',
      },
      {
        status: 403,
      }
    );
  }

  try {
    const response = await fetch(
      parsedUrl.toString(),
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',

          Referer:
            'https://weebcentral.com/',

          Accept:
            'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },

        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            `No se pudo obtener la imagen. Status: ${response.status}`,
        },
        {
          status: response.status,
        }
      );
    }

    const contentType =
      response.headers.get(
        'content-type'
      ) || 'image/jpeg';

    const buffer =
      await response.arrayBuffer();

    return new NextResponse(
      buffer,
      {
        status: 200,

        headers: {
          'Content-Type':
            contentType,

          'Cache-Control':
            'public, max-age=86400, s-maxage=86400',
        },
      }
    );
  } catch (error) {
    console.error(
      'Error al hacer proxy de imagen:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Error al obtener la imagen',
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// GET
// ============================================================

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

    // ========================================================
    // IMAGEN
    // ========================================================

    if (type === 'image') {
      if (!targetUrl) {
        return NextResponse.json(
          {
            error:
              'Falta la URL de la imagen',
          },
          {
            status: 400,
          }
        );
      }

      return proxyImage(targetUrl);
    }

    // ========================================================
    // VALIDAR URL GENERAL
    // ========================================================

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

    const cleanUrl =
      targetUrl.trim();

    // ========================================================
    // CAPÍTULO
    // ========================================================

    if (type === 'chapter') {
      if (
        !isValidWeebCentralUrl(
          cleanUrl
        )
      ) {
        return NextResponse.json(
          {
            error:
              'La URL del capítulo no pertenece a WeebCentral',
          },
          {
            status: 400,
          }
        );
      }

      const chapterId =
        getChapterId(cleanUrl);

      if (!chapterId) {
        return NextResponse.json(
          {
            error:
              'No se pudo obtener el ID del capítulo',
          },
          {
            status: 400,
          }
        );
      }

      console.log(
        'Solicitando capítulo al connector:',
        chapterId
      );

      const chapter =
        await connectorFetch<ConnectorChapterResponse>(
          `/chapter?chapterId=${encodeURIComponent(
            chapterId
          )}`
        );

      if (
        !chapter.success ||
        !Array.isArray(
          chapter.images
        )
      ) {
        throw new Error(
          chapter.error ||
            'El connector no devolvió imágenes'
        );
      }

      return NextResponse.json({
        images:
          chapter.images.map(
            (imageUrl) =>
              `/api/manga?type=image&url=${encodeURIComponent(
                imageUrl
              )}`
          ),
      });
    }

    // ========================================================
    // MANGA
    // ========================================================

    if (
      !isValidWeebCentralUrl(
        cleanUrl
      )
    ) {
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

    const seriesId =
      getSeriesId(cleanUrl);

    if (!seriesId) {
      return NextResponse.json(
        {
          error:
            'No se pudo obtener el ID de la serie.',
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      '=========================================='
    );

    console.log(
      'SOLICITANDO MANGA AL CONNECTOR'
    );

    console.log(
      'Series ID:',
      seriesId
    );

    console.log(
      'URL:',
      cleanUrl
    );

    console.log(
      'Connector:',
      CONNECTOR_URL
    );

    console.log(
      '=========================================='
    );

    // ========================================================
    // INFORMACIÓN DEL MANGA
    // ========================================================

    const manga =
      await connectorFetch<ConnectorMangaResponse>(
        `/manga?url=${encodeURIComponent(
          cleanUrl
        )}`
      );

    if (!manga.success) {
      throw new Error(
        manga.error ||
          'El connector no pudo obtener el manga'
      );
    }

    // ========================================================
    // CAPÍTULOS
    // ========================================================

    console.log(
      'Solicitando capítulos al connector...'
    );

    const chapterData =
      await connectorFetch<ConnectorChaptersResponse>(
        `/chapters?seriesId=${encodeURIComponent(
          manga.seriesId || seriesId
        )}`
      );

    if (
      !chapterData.success ||
      !Array.isArray(
        chapterData.chapters
      )
    ) {
      throw new Error(
        chapterData.error ||
          'El connector no pudo obtener los capítulos'
      );
    }

    // ========================================================
    // PORTADA
    // ========================================================

    const proxiedCover =
      manga.cover
        ? `/api/manga?type=image&url=${encodeURIComponent(
            manga.cover
          )}`
        : '';

    // ========================================================
    // RESPUESTA FINAL DE TOMO
    // ========================================================

    const response = {
      title:
        manga.title ||
        'Manga sin título',

      cover:
        proxiedCover,

      synopsis:
        manga.synopsis || '',

      totalChapters:
        chapterData.chapters.length,

      chapters:
        chapterData.chapters,
    };

    console.log(
      'Manga obtenido:',
      response.title
    );

    console.log(
      'Capítulos:',
      response.totalChapters
    );

    return NextResponse.json(
      response
    );
  } catch (error) {
    console.error(
      '=========================================='
    );

    console.error(
      'ERROR EN /api/manga'
    );

    console.error(error);

    console.error(
      '=========================================='
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
