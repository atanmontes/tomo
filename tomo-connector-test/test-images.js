const https = require("https");
const cheerio = require("cheerio");

// ==========================================
// CONFIGURACIÓN
// ==========================================

const CHAPTER_ID = "01J76XYZW77APVWYRPG66WF9Q8";

const CHAPTER_URL =
  `https://weebcentral.com/chapters/${CHAPTER_ID}/images` +
  `?is_prev=False&current_page=1&reading_style=long_strip`;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",

  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

  "Accept-Language": "en-US,en;q=0.9",

  "Referer": "https://weebcentral.com/",
};

// ==========================================
// PETICIÓN
// ==========================================

console.log("==========================================");
console.log("PRUEBA DE IMÁGENES");
console.log("==========================================");
console.log("");

console.log("CHAPTER URL:");
console.log(CHAPTER_URL);
console.log("");

https.get(CHAPTER_URL, { headers: HEADERS }, (res) => {
  console.log("STATUS:", res.statusCode);
  console.log("SERVER:", res.headers.server || "N/A");
  console.log("CONTENT-TYPE:", res.headers["content-type"] || "N/A");
  console.log("");

  let html = "";

  res.setEncoding("utf8");

  res.on("data", (chunk) => {
    html += chunk;
  });

  res.on("end", () => {
    console.log("BYTES RECIBIDOS:", Buffer.byteLength(html, "utf8"));
    console.log("");

    if (res.statusCode !== 200) {
      console.log("❌ HTTP ERROR");
      console.log("");

      console.log("Primeros 500 caracteres:");
      console.log(html.substring(0, 500));

      return;
    }

    const $ = cheerio.load(html);

    // ==========================================
    // BUSCAR IMÁGENES
    // ==========================================

    const images = [];

    $("img").each((index, element) => {
      const src =
        $(element).attr("src") ||
        $(element).attr("data-src") ||
        $(element).attr("data-lazy-src");

      if (!src) {
        return;
      }

      // Convertir URL relativa a absoluta.
      // IMPORTANTE:
      // usamos CHAPTER_URL y NO URL.
      const absoluteUrl = new URL(src, CHAPTER_URL).toString();

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

    // ==========================================
    // RESULTADOS
    // ==========================================

    console.log("==========================================");
    console.log("RESULTADO");
    console.log("==========================================");
    console.log("");

    console.log("IMÁGENES ENCONTRADAS:", images.length);
    console.log("");

    if (images.length === 0) {
      console.log("❌ NO SE ENCONTRARON IMÁGENES");
      console.log("");

      console.log("Título de la página:");
      console.log($("title").text().trim());

      console.log("");
      console.log("Primeros 1000 caracteres del HTML:");
      console.log(html.substring(0, 1000));

      return;
    }

    console.log("✅ IMÁGENES ENCONTRADAS");
    console.log("");

    // Mostrar las primeras 10
    const previewCount = Math.min(images.length, 10);

    for (let i = 0; i < previewCount; i++) {
      console.log(`${i + 1}. ${images[i]}`);
    }

    if (images.length > 10) {
      console.log("");
      console.log(`... y ${images.length - 10} imágenes más.`);
    }

    // ==========================================
    // JSON COMPLETO
    // ==========================================

    console.log("");
    console.log("==========================================");
    console.log("JSON");
    console.log("==========================================");
    console.log("");

    console.log(
      JSON.stringify(
        {
          success: true,
          chapterId: CHAPTER_ID,
          chapterUrl: CHAPTER_URL,
          totalImages: images.length,
          images,
        },
        null,
        2
      )
    );
  });
}).on("error", (error) => {
  console.error("");
  console.error("❌ ERROR DE CONEXIÓN:");
  console.error(error);
});