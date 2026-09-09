const https = require("https");
const cheerio = require("cheerio");

const SERIES_ID = "01J76XYCJ1SSSQSAEKZXCMKMAD";

const SERIES_URL =
  `https://weebcentral.com/series/${SERIES_ID}/Ijiranaide-Nagatoro-san`;

const CHAPTERS_URL =
  `https://weebcentral.com/series/${SERIES_ID}/full-chapter-list`;

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",

  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

  "Accept-Language": "en-US,en;q=0.9",
};

function request(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    console.log("---------------------------------");
    console.log("REQUEST:", url);
    console.log("---------------------------------");

    const req = https.get(url, { headers }, (res) => {
      let body = "";

      console.log("STATUS:", res.statusCode);
      console.log("SERVER:", res.headers.server || "(none)");
      console.log(
        "CONTENT-TYPE:",
        res.headers["content-type"] || "(none)"
      );
      console.log(
        "LOCATION:",
        res.headers.location || "(none)"
      );
      console.log("");

      if (
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location
      ) {
        if (redirectCount >= 5) {
          reject(new Error("Demasiados redirects."));
          return;
        }

        const nextUrl = new URL(res.headers.location, url).toString();

        console.log("➡️ REDIRECT DETECTADO");
        console.log("SIGUIENTE URL:");
        console.log(nextUrl);
        console.log("");

        res.resume();

        request(nextUrl, redirectCount + 1)
          .then(resolve)
          .catch(reject);

        return;
      }

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          finalUrl: url,
        });
      });
    });

    req.on("error", reject);
  });
}

async function main() {
  console.log("=================================");
  console.log(" TOMO CONNECTOR — CHAPTER TEST");
  console.log("=================================");
  console.log("");

  console.log("SERIES:");
  console.log(SERIES_URL);
  console.log("");

  console.log("CHAPTER LIST:");
  console.log(CHAPTERS_URL);
  console.log("");

  try {
    const result = await request(CHAPTERS_URL);

    console.log("=================================");
    console.log(" RESPUESTA FINAL");
    console.log("=================================");
    console.log("");

    console.log("URL FINAL:");
    console.log(result.finalUrl);

    console.log("");

    console.log("HTTP STATUS:");
    console.log(result.statusCode);

    console.log("");

    console.log("BYTES RECIBIDOS:");
    console.log(result.body.length);

    console.log("");

    if (result.statusCode !== 200) {
      console.log("❌ La respuesta final NO fue 200.");
      console.log("");

      console.log("PRIMEROS 1000 CARACTERES:");
      console.log(result.body.slice(0, 1000));

      return;
    }

    console.log("✅ HTTP 200");
    console.log("");

    const $ = cheerio.load(result.body);

    const chapters = [];

    $('a[href*="/chapters/"]').each((_, element) => {
      const href = $(element).attr("href");
      const title = $(element)
        .clone()
        .find("*")
        .remove()
        .end()
        .text()
        .replace(/\s+/g, " ")
        .trim();

      if (!href) return;

      const match = href.match(
        /\/chapters\/([A-Z0-9]{26})/
      );

      if (!match) return;

      const id = match[1];

      chapters.push({
        id,
        title,
        url: new URL(href, CHAPTERS_URL).toString(),
      });
    });

    console.log("CAPÍTULOS ENCONTRADOS:");
    console.log(chapters.length);
    console.log("");

    if (chapters.length === 0) {
      console.log("❌ No encontramos capítulos.");
      return;
    }

    console.log("PRIMEROS 10:");
    console.log("");

    chapters.slice(0, 10).forEach((chapter, index) => {
      console.log(`${index + 1}. ${chapter.title}`);
      console.log(`   ID: ${chapter.id}`);
      console.log(`   URL: ${chapter.url}`);
      console.log("");
    });

    console.log("=================================");
    console.log(" CAPÍTULOS FUNCIONANDO");
    console.log("=================================");
  } catch (error) {
    console.log("");
    console.log("❌ ERROR:");
    console.log(error);
  }
}

main();