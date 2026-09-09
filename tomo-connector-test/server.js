const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");
const cheerio = require("cheerio");

const PORT = process.env.PORT || 3001;
const HOST = "0.0.0.0";

const WEBCENTRAL_BASE = "https://weebcentral.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/130.0.0.0 Safari/537.36",

  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

  "Accept-Language": "en-US,en;q=0.9",
};

// ==========================================
// RESPUESTA JSON
// ==========================================

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  res.end(JSON.stringify(data, null, 2));
}

// ==========================================
// DESCARGAR HTML
// ==========================================

function fetchHtml(url) {
  return fetch(url, {
    method: "GET",
    headers: HEADERS,
    redirect: "follow",
  }).then(async (response) => {
    const html = await response.text();

    if (!response.ok) {
      throw new Error(
        `WeebCentral respondió HTTP ${response.status}`
      );
    }

    return html;
  });
}

// ==========================================
// EXTRAER ID DE SERIE
// ==========================================

function getSeriesId(seriesUrl) {
  const match = seriesUrl.match(
    /\/series\/([A-Z0-9]{26})/i
  );

  return match ? match[1] : "";
}

// ==========================================
// EXTRAER ID DE CAPÍTULO
// ==========================================

function getChapterId(chapterUrl) {
  const match = chapterUrl.match(
    /\/chapters\/([A-Z0-9]{26})/i
  );

  return match ? match[1] : "";
}

// ==========================================
// LIMPIAR TEXTO
// ==========================================

function cleanText(value) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

// ==========================================
// OBTENER SINOPSIS
// ==========================================

function parseSynopsis($) {
  let synopsis = "";

  // ========================================
  // MÉTODO 1
  // Buscar literalmente "Description"
  // ========================================

  $("body *").each((index, element) => {
    if (synopsis) {
      return;
    }

    const text = cleanText(
      $(element)
        .clone()
        .children()
        .remove()
        .end()
        .text()
    );

    if (text !== "Description") {
      return;
    }

    // Buscar el siguiente elemento con contenido
    let next = $(element).next();

    while (next.length) {
      const nextText = cleanText(
        next.text()
      );

      if (
        nextText &&
        nextText !== "Description"
      ) {
        synopsis = nextText;
        break;
      }

      next = next.next();
    }
  });

  // ========================================
  // MÉTODO 2
  // Si Description está dentro de un contenedor,
  // buscar el siguiente hermano del contenedor
  // ========================================

  if (!synopsis) {
    $("body *").each((index, element) => {
      if (synopsis) {
        return;
      }

      const directText = cleanText(
        $(element)
          .clone()
          .children()
          .remove()
          .end()
          .text()
      );

      if (directText !== "Description") {
        return;
      }

      const parent = $(element).parent();

      if (!parent.length) {
        return;
      }

      let next = parent.next();

      while (next.length) {
        const nextText = cleanText(
          next.text()
        );

        if (
          nextText &&
          nextText !== "Description"
        ) {
          synopsis = nextText;
          break;
        }

        next = next.next();
      }
    });
  }

  // ========================================
  // MÉTODO 3
  // Buscar clases conocidas
  // ========================================

  if (!synopsis) {
    const selectors = [
      '[class*="synopsis"]',
      '[class*="description"]',
      '[class*="summary"]',
      '[id*="synopsis"]',
      '[id*="description"]',
      '[id*="summary"]',
    ];

    for (const selector of selectors) {
      const value = cleanText(
        $(selector)
          .first()
          .text()
      );

      if (
        value &&
        value.toLowerCase() !==
          "description"
      ) {
        synopsis = value;
        break;
      }
    }
  }

  // ========================================
  // MÉTODO 4
  // Buscar párrafos con contenido
  // ========================================

  if (!synopsis) {
    $("p").each((index, element) => {
      if (synopsis) {
        return;
      }

      const value = cleanText(
        $(element).text()
      );

      if (
        value.length > 40 &&
        !value.includes("Copyright") &&
        !value.includes("Login") &&
        !value.includes("Register")
      ) {
        synopsis = value;
      }
    });
  }

  return synopsis;
}

// ==========================================
// PARSEAR INFORMACIÓN DE SERIE
// ==========================================

function parseSeries(html, seriesUrl) {
  const $ = cheerio.load(html);

  // ========================================
  // TÍTULO
  // ========================================

  let title = "";

  const titleSelectors = [
    "h1",
    "h2",
    '[class*="title"]',
  ];

  for (const selector of titleSelectors) {
    const value = cleanText(
      $(selector)
        .first()
        .text()
    );

    if (value) {
      title = value;
      break;
    }
  }

  // ========================================
  // SINOPSIS
  // ========================================

  const synopsis =
    parseSynopsis($);

  // ========================================
  // SERIES ID
  // ========================================

  const seriesId =
    getSeriesId(seriesUrl);

  // ========================================
  // PORTADA
  // ========================================

  let cover = "";

  if (seriesId) {
    cover =
      `https://temp.compsci88.com/cover/normal/${seriesId}.webp`;
  }

  return {
    success: true,
    seriesId,
    title,
    cover,
    synopsis,
    source: "weebcentral",
    url: seriesUrl,
    pageBytes:
      Buffer.byteLength(
        html,
        "utf8"
      ),
    hasPageContent:
      $("body")
        .text()
        .trim()
        .length > 0,
  };
}

// ==========================================
// PARSEAR CAPÍTULOS
// ==========================================

function parseChapters(html) {
  const $ = cheerio.load(html);

  const chapters = [];

  $('a[href*="/chapters/"]').each(
    (index, element) => {
      const href =
        $(element).attr("href");

      if (!href) {
        return;
      }

      const chapterUrl =
        new URL(
          href,
          WEBCENTRAL_BASE
        ).toString();

      const chapterId =
        getChapterId(
          chapterUrl
        );

      if (!chapterId) {
        return;
      }

      // ======================================
      // OBTENER EL TÍTULO REAL
      // ======================================
      //
      // WeebCentral estructura los capítulos así:
      //
      // <span class="grow ...">
      //   <span>Plot 1</span>
      //   <span class="link-info">
      //     ...
      //     <span>Last Read</span>
      //   </span>
      // </span>
      //
      // Por eso tomamos únicamente el primer
      // span dentro de .grow.
      //
      // Esto funciona para:
      // Plot 1
      // Chapter 1
      // episode. 1
      // No. 1
      // etc.
      // ======================================

      let title = "";

      const titleElement =
        $(element)
          .find("span.grow > span")
          .not(".link-info")
          .first();

      if (titleElement.length) {
        title = cleanText(
          titleElement.text()
        );
      }

      // ======================================
      // FALLBACK
      // ======================================
      //
      // Si WeebCentral cambia ligeramente
      // la estructura, intentamos obtener el
      // primer span dentro de .grow.
      // ======================================

      if (!title) {
        const growElement =
          $(element)
            .find("span.grow")
            .first();

        if (growElement.length) {
          title = cleanText(
            growElement
              .children("span")
              .first()
              .text()
          );
        }
      }

      // ======================================
      // ÚLTIMO FALLBACK
      // ======================================

      if (!title) {
        title = cleanText(
          $(element).text()
        );

        // Si por algún cambio de HTML se colara
        // "Last Read", lo eliminamos solamente
        // como último recurso.
        title = title
          .replace(/\bLast Read\b/gi, "")
          .trim();
      }

      chapters.push({
        title,
        id: chapterId,
        url: chapterUrl,
      });
    }
  );

  // ==========================================
  // ELIMINAR DUPLICADOS
  // ==========================================

  const uniqueChapters = [];
  const seen = new Set();

  for (const chapter of chapters) {
    if (
      seen.has(chapter.id)
    ) {
      continue;
    }

    seen.add(chapter.id);
    uniqueChapters.push(
      chapter
    );
  }

  return uniqueChapters;
}

// ==========================================
// PARSEAR IMÁGENES DEL CAPÍTULO
// ==========================================

function parseChapterImages(
  html,
  chapterUrl
) {
  const $ =
    cheerio.load(html);

  const images = [];

  $("img").each(
    (index, element) => {
      const src =
        $(element).attr("src") ||
        $(element).attr(
          "data-src"
        ) ||
        $(element).attr(
          "data-lazy-src"
        );

      if (!src) {
        return;
      }

      const absoluteUrl =
        new URL(
          src,
          chapterUrl
        ).toString();

      // Ignorar imágenes internas
      // de WeebCentral
      if (
        absoluteUrl.includes(
          "/static/"
        )
      ) {
        return;
      }

      if (
        absoluteUrl.includes(
          "brand"
        )
      ) {
        return;
      }

      // Evitar duplicados
      if (
        !images.includes(
          absoluteUrl
        )
      ) {
        images.push(
          absoluteUrl
        );
      }
    }
  );

  return images;
}

// ==========================================
// SERVIDOR
// ==========================================

const server =
  http.createServer(
    async (req, res) => {
      const requestUrl =
        new URL(
          req.url || "/",
          `http://${req.headers.host || `${HOST}:${PORT}`}`
        );

      console.log(
        `${req.method} ${requestUrl.pathname}`
      );

      // ========================================
      // CORS
      // ========================================

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
      );

      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
      );

      // ========================================
      // OPTIONS
      // ========================================

      if (
        req.method ===
        "OPTIONS"
      ) {
        res.writeHead(204);
        res.end();
        return;
      }

      // ========================================
      // GET /
      // ========================================

      if (
        req.method === "GET" &&
        requestUrl.pathname === "/"
      ) {
        sendJson(
          res,
          200,
          {
            success: true,
            name: "TOMO Connector",
            version: "0.4.0",
            status: "online",
          }
        );

        return;
      }

      // ========================================
      // GET /manga
      // ========================================

      if (
        req.method === "GET" &&
        requestUrl.pathname ===
          "/manga"
      ) {
        const seriesUrl =
          requestUrl.searchParams.get(
            "url"
          );

        if (!seriesUrl) {
          sendJson(
            res,
            400,
            {
              success: false,
              error:
                "Falta el parámetro ?url=",
            }
          );

          return;
        }

        let parsedUrl;

        try {
          parsedUrl =
            new URL(
              seriesUrl
            );
        } catch {
          sendJson(
            res,
            400,
            {
              success: false,
              error:
                "La URL proporcionada no es válida",
            }
          );

          return;
        }

        // Solo permitimos WeebCentral
        if (
          parsedUrl.hostname !==
            "weebcentral.com" &&
          parsedUrl.hostname !==
            "www.weebcentral.com"
        ) {
          sendJson(
            res,
            400,
            {
              success: false,
              error:
                "La URL debe pertenecer a WeebCentral",
            }
          );

          return;
        }

        try {
          console.log("");
          console.log(
            "Obteniendo serie:"
          );
          console.log(
            seriesUrl
          );
          console.log("");

          const html =
            await fetchHtml(
              seriesUrl
            );

          console.log(
            `HTML recibido: ${Buffer.byteLength(
              html,
              "utf8"
            )} bytes`
          );

          const manga =
            parseSeries(
              html,
              seriesUrl
            );

          console.log(
            "Título:",
            manga.title
          );

          console.log(
            "Series ID:",
            manga.seriesId
          );

          console.log(
            "Sinopsis:",
            manga.synopsis
              ? "ENCONTRADA"
              : "NO ENCONTRADA"
          );

          console.log("");

          sendJson(
            res,
            200,
            manga
          );
        } catch (error) {
          console.error("");
          console.error(
            "ERROR WEBCENTRAL:"
          );
          console.error(
            error
          );
          console.error("");

          sendJson(
            res,
            502,
            {
              success: false,
              error:
                "No se pudo obtener la información de WeebCentral",
              details:
                error.message,
            }
          );
        }

        return;
      }

      // ========================================
      // GET /chapters
      // ========================================

      if (
        req.method === "GET" &&
        requestUrl.pathname ===
          "/chapters"
      ) {
        const seriesId =
          requestUrl.searchParams.get(
            "seriesId"
          );

        if (!seriesId) {
          sendJson(
            res,
            400,
            {
              success: false,
              error:
                "Falta el parámetro ?seriesId=",
            }
          );

          return;
        }

        if (
          !/^[A-Z0-9]{26}$/.test(
            seriesId
          )
        ) {
          sendJson(
            res,
            400,
            {
              success: false,
              error:
                "El seriesId no es válido",
            }
          );

          return;
        }

        const chaptersUrl =
          `${WEBCENTRAL_BASE}/series/${seriesId}/full-chapter-list`;

        try {
          console.log("");
          console.log(
            "Obteniendo capítulos:"
          );
          console.log(
            chaptersUrl
          );
          console.log("");

          const html =
            await fetchHtml(
              chaptersUrl
            );

          console.log(
            `HTML recibido: ${Buffer.byteLength(
              html,
              "utf8"
            )} bytes`
          );

          const chapters =
            parseChapters(
              html
            );

          console.log(
            "Capítulos encontrados:",
            chapters.length
          );

          console.log("");

          sendJson(
            res,
            200,
            {
              success: true,
              seriesId,
              totalChapters:
                chapters.length,
              chapters,
            }
          );
        } catch (error) {
          console.error("");
          console.error(
            "ERROR OBTENIENDO CAPÍTULOS:"
          );
          console.error(
            error
          );
          console.error("");

          sendJson(
            res,
            502,
            {
              success: false,
              error:
                "No se pudieron obtener los capítulos",
              details:
                error.message,
            }
          );
        }

        return;
      }

      // ========================================
      // GET /chapter
      // ========================================

      if (
        req.method === "GET" &&
        requestUrl.pathname ===
          "/chapter"
      ) {
        const chapterId =
          requestUrl.searchParams.get(
            "chapterId"
          );

        if (!chapterId) {
          sendJson(
            res,
            400,
            {
              success: false,
              error:
                "Falta el parámetro ?chapterId=",
            }
          );

          return;
        }

        if (
          !/^[A-Z0-9]{26}$/.test(
            chapterId
          )
        ) {
          sendJson(
            res,
            400,
            {
              success: false,
              error:
                "El chapterId no es válido",
            }
          );

          return;
        }

        const chapterUrl =
          `${WEBCENTRAL_BASE}/chapters/${chapterId}/images` +
          `?is_prev=False&current_page=1&reading_style=long_strip`;

        try {
          console.log("");
          console.log(
            "=========================================="
          );
          console.log(
            "OBTENIENDO IMÁGENES DEL CAPÍTULO"
          );
          console.log(
            "=========================================="
          );
          console.log(
            "Chapter ID:",
            chapterId
          );
          console.log(
            "URL:",
            chapterUrl
          );
          console.log("");

          const html =
            await fetchHtml(
              chapterUrl
            );

          console.log(
            `HTML recibido: ${Buffer.byteLength(
              html,
              "utf8"
            )} bytes`
          );

          const images =
            parseChapterImages(
              html,
              chapterUrl
            );

          console.log(
            "Imágenes encontradas:",
            images.length
          );

          console.log("");

          sendJson(
            res,
            200,
            {
              success: true,
              chapterId,
              chapterUrl,
              totalImages:
                images.length,
              images,
            }
          );
        } catch (error) {
          console.error("");
          console.error(
            "ERROR OBTENIENDO IMÁGENES:"
          );
          console.error(
            error
          );
          console.error("");

          sendJson(
            res,
            502,
            {
              success: false,
              error:
                "No se pudieron obtener las imágenes del capítulo",
              details:
                error.message,
            }
          );
        }

        return;
      }

      // ========================================
      // 404
      // ========================================

      sendJson(
        res,
        404,
        {
          success: false,
          error:
            "Endpoint no encontrado",
          path:
            requestUrl.pathname,
        }
      );
    }
  );

// ==========================================
// INICIAR SERVIDOR
// ==========================================

server.listen(
  PORT,
  HOST,
  () => {
    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      "             TOMO CONNECTOR"
    );
    console.log(
      "=========================================="
    );
    console.log("");

    console.log(
      `Servidor escuchando en ${HOST}:${PORT}`
    );

    console.log("");

    console.log(
      "Estado: ONLINE"
    );

    console.log("");

    console.log(
      "Endpoints disponibles:"
    );

    console.log(
      `  GET http://${HOST}:${PORT}/`
    );

    console.log(
      `  GET http://${HOST}:${PORT}/manga?url=...`
    );

    console.log(
      `  GET http://${HOST}:${PORT}/chapters?seriesId=...`
    );

    console.log(
      `  GET http://${HOST}:${PORT}/chapter?chapterId=...`
    );

    console.log("");

    console.log(
      "Presiona Ctrl+C para detenerlo."
    );

    console.log("");
  }
);