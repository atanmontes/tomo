const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");
const cheerio = require("cheerio");

const PORT = 3001;
const HOST = "127.0.0.1";

const WEBCENTRAL_BASE = "https://weebcentral.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/130.0.0.0 Safari/537.36",

  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

  "Accept-Language": "en-US,en;q=0.9",

  Referer: "https://weebcentral.com/",
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
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: HEADERS,
      },
      (response) => {
        let html = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          html += chunk;
        });

        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `WeebCentral respondió HTTP ${response.statusCode}`
              )
            );

            return;
          }

          resolve(html);
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });

    request.setTimeout(15000, () => {
      request.destroy(
        new Error(
          "Tiempo de espera agotado al conectar con WeebCentral"
        )
      );
    });
  });
}

// ==========================================
// EXTRAER ID DE SERIE
// ==========================================

function getSeriesId(seriesUrl) {
  const match = seriesUrl.match(
    /\/series\/([A-Z0-9]{26})/
  );

  return match ? match[1] : "";
}

// ==========================================
// EXTRAER ID DE CAPÍTULO
// ==========================================

function getChapterId(chapterUrl) {
  const match = chapterUrl.match(
    /\/chapters\/([A-Z0-9]{26})/
  );

  return match ? match[1] : "";
}

// ==========================================
// PARSEAR INFORMACIÓN DE SERIE
// ==========================================

function parseSeries(html, seriesUrl) {
  const $ = cheerio.load(html);

  let title = "";

  const titleSelectors = [
    "h1",
    "h2",
    '[class*="title"]',
  ];

  for (const selector of titleSelectors) {
    const value = $(selector)
      .first()
      .text()
      .trim();

    if (value) {
      title = value;
      break;
    }
  }

  let synopsis = "";

  const synopsisSelectors = [
    '[class*="synopsis"]',
    '[class*="description"]',
    '[class*="summary"]',
  ];

  for (const selector of synopsisSelectors) {
    const value = $(selector)
      .first()
      .text()
      .trim();

    if (value) {
      synopsis = value;
      break;
    }
  }

  const seriesId = getSeriesId(seriesUrl);

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
    pageBytes: Buffer.byteLength(html, "utf8"),
    hasPageContent:
      $("body").text().trim().length > 0,
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
      const href = $(element).attr("href");

      if (!href) {
        return;
      }

      const chapterUrl = new URL(
        href,
        WEBCENTRAL_BASE
      ).toString();

      const chapterId =
        getChapterId(chapterUrl);

      if (!chapterId) {
        return;
      }

      // ======================================
      // OBTENER TÍTULO LIMPIO
      // ======================================

      const rawText = $(element)
        .text()
        .replace(/\s+/g, " ")
        .trim();

      const chapterMatch = rawText.match(
        /^(Chapter\s+\d+(?:\.\d+)?)/i
      );

      let title = "";

      if (chapterMatch) {
        title = chapterMatch[1].trim();
      } else {
        const clone = $(element).clone();

        clone.children().remove();

        title = clone
          .text()
          .replace(/\s+/g, " ")
          .trim();
      }

      if (!title) {
        title = rawText;
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
    if (seen.has(chapter.id)) {
      continue;
    }

    seen.add(chapter.id);
    uniqueChapters.push(chapter);
  }

  return uniqueChapters;
}

// ==========================================
// PARSEAR IMÁGENES DEL CAPÍTULO
// ==========================================

function parseChapterImages(html, chapterUrl) {
  const $ = cheerio.load(html);

  const images = [];

  $("img").each((index, element) => {
    const src =
      $(element).attr("src") ||
      $(element).attr("data-src") ||
      $(element).attr("data-lazy-src");

    if (!src) {
      return;
    }

    const absoluteUrl =
      new URL(src, chapterUrl).toString();

    // Ignorar imágenes internas de WeebCentral
    if (absoluteUrl.includes("/static/")) {
      return;
    }

    if (absoluteUrl.includes("brand")) {
      return;
    }

    // Evitar duplicados
    if (!images.includes(absoluteUrl)) {
      images.push(absoluteUrl);
    }
  });

  return images;
}

// ==========================================
// SERVIDOR
// ==========================================

const server = http.createServer(
  async (req, res) => {
    const requestUrl = new URL(
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

    if (req.method === "OPTIONS") {
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
      sendJson(res, 200, {
        success: true,
        name: "TOMO Connector",
        version: "0.4.0",
        status: "online",
      });

      return;
    }

    // ========================================
    // GET /manga
    // ========================================

    if (
      req.method === "GET" &&
      requestUrl.pathname === "/manga"
    ) {
      const seriesUrl =
        requestUrl.searchParams.get("url");

      if (!seriesUrl) {
        sendJson(res, 400, {
          success: false,
          error: "Falta el parámetro ?url=",
        });

        return;
      }

      let parsedUrl;

      try {
        parsedUrl = new URL(seriesUrl);
      } catch {
        sendJson(res, 400, {
          success: false,
          error:
            "La URL proporcionada no es válida",
        });

        return;
      }

      // Solo permitimos WeebCentral
      if (
        parsedUrl.hostname !==
          "weebcentral.com" &&
        parsedUrl.hostname !==
          "www.weebcentral.com"
      ) {
        sendJson(res, 400, {
          success: false,
          error:
            "La URL debe pertenecer a WeebCentral",
        });

        return;
      }

      try {
        console.log("");
        console.log("Obteniendo serie:");
        console.log(seriesUrl);
        console.log("");

        const html =
          await fetchHtml(seriesUrl);

        console.log(
          `HTML recibido: ${Buffer.byteLength(
            html,
            "utf8"
          )} bytes`
        );

        const manga = parseSeries(
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

        console.log("");

        sendJson(res, 200, manga);
      } catch (error) {
        console.error("");
        console.error(
          "ERROR WEBCENTRAL:"
        );
        console.error(error);
        console.error("");

        sendJson(res, 502, {
          success: false,
          error:
            "No se pudo obtener la información de WeebCentral",
          details: error.message,
        });
      }

      return;
    }

    // ========================================
    // GET /chapters
    // ========================================

    if (
      req.method === "GET" &&
      requestUrl.pathname === "/chapters"
    ) {
      const seriesId =
        requestUrl.searchParams.get(
          "seriesId"
        );

      if (!seriesId) {
        sendJson(res, 400, {
          success: false,
          error:
            "Falta el parámetro ?seriesId=",
        });

        return;
      }

      if (
        !/^[A-Z0-9]{26}$/.test(seriesId)
      ) {
        sendJson(res, 400, {
          success: false,
          error:
            "El seriesId no es válido",
        });

        return;
      }

      const chaptersUrl =
        `${WEBCENTRAL_BASE}/series/${seriesId}/full-chapter-list`;

      try {
        console.log("");
        console.log(
          "Obteniendo capítulos:"
        );
        console.log(chaptersUrl);
        console.log("");

        const html =
          await fetchHtml(chaptersUrl);

        console.log(
          `HTML recibido: ${Buffer.byteLength(
            html,
            "utf8"
          )} bytes`
        );

        const chapters =
          parseChapters(html);

        console.log(
          "Capítulos encontrados:",
          chapters.length
        );

        console.log("");

        sendJson(res, 200, {
          success: true,
          seriesId,
          totalChapters: chapters.length,
          chapters,
        });
      } catch (error) {
        console.error("");
        console.error(
          "ERROR OBTENIENDO CAPÍTULOS:"
        );
        console.error(error);
        console.error("");

        sendJson(res, 502, {
          success: false,
          error:
            "No se pudieron obtener los capítulos",
          details: error.message,
        });
      }

      return;
    }

    // ========================================
    // GET /chapter
    // ========================================

    if (
      req.method === "GET" &&
      requestUrl.pathname === "/chapter"
    ) {
      const chapterId =
        requestUrl.searchParams.get(
          "chapterId"
        );

      if (!chapterId) {
        sendJson(res, 400, {
          success: false,
          error:
            "Falta el parámetro ?chapterId=",
        });

        return;
      }

      if (
        !/^[A-Z0-9]{26}$/.test(chapterId)
      ) {
        sendJson(res, 400, {
          success: false,
          error:
            "El chapterId no es válido",
        });

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
          await fetchHtml(chapterUrl);

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

        sendJson(res, 200, {
          success: true,
          chapterId,
          chapterUrl,
          totalImages: images.length,
          images,
        });
      } catch (error) {
        console.error("");
        console.error(
          "ERROR OBTENIENDO IMÁGENES:"
        );
        console.error(error);
        console.error("");

        sendJson(res, 502, {
          success: false,
          error:
            "No se pudieron obtener las imágenes del capítulo",
          details: error.message,
        });
      }

      return;
    }

    // ========================================
    // 404
    // ========================================

    sendJson(res, 404, {
      success: false,
      error: "Endpoint no encontrado",
      path: requestUrl.pathname,
    });
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
      `Servidor: http://${HOST}:${PORT}`
    );

    console.log("");

    console.log("Estado: ONLINE");

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