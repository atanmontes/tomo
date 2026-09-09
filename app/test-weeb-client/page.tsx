"use client";

import { useState } from "react";

const SERIES_ID = "01J76XYZW77APVWYRPG66WF9Q8";

const SERIES_URL = `https://weebcentral.com/series/${SERIES_ID}`;

const CHAPTER_LIST_URL = `https://weebcentral.com/series/${SERIES_ID}/full-chapter-list`;

const CHAPTER_URL =
  "https://weebcentral.com/chapters/01J76XYZW77APVWYRPG66WF9Q8/images?is_prev=False&current_page=1&reading_style=long_strip";

const COVER_URL = `https://temp.compsci88.com/cover/normal/${SERIES_ID}.webp`;

type TestResult = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  details?: string;
};

export default function TestWeebClientPage() {
  const [seriesTest, setSeriesTest] = useState<TestResult>({
    status: "idle",
    message: "Sin probar",
  });

  const [chaptersTest, setChaptersTest] = useState<TestResult>({
    status: "idle",
    message: "Sin probar",
  });

  const [imagesTest, setImagesTest] = useState<TestResult>({
    status: "idle",
    message: "Sin probar",
  });

  const [coverLoaded, setCoverLoaded] = useState(false);
  const [coverError, setCoverError] = useState(false);

  async function testFetch(
    url: string,
    setter: (result: TestResult) => void,
    label: string
  ) {
    setter({
      status: "loading",
      message: `Probando ${label}...`,
    });

    const started = performance.now();

    try {
      const response = await fetch(url, {
        method: "GET",
      });

      const elapsed = Math.round(performance.now() - started);

      const text = await response.text();

      setter({
        status: response.ok ? "success" : "error",
        message: `HTTP ${response.status}`,
        details: [
          `Tiempo: ${elapsed} ms`,
          `URL: ${url}`,
          `Bytes recibidos: ${text.length}`,
          `Content-Type: ${
            response.headers.get("content-type") ?? "desconocido"
          }`,
          "",
          text.slice(0, 500),
        ].join("\n"),
      });
    } catch (error) {
      const elapsed = Math.round(performance.now() - started);

      setter({
        status: "error",
        message: "FETCH FALLÓ",
        details: [
          `Tiempo: ${elapsed} ms`,
          `URL: ${url}`,
          "",
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
          "",
          "Si el navegador muestra 'Failed to fetch', probablemente estamos chocando con CORS o una política del sitio.",
        ].join("\n"),
      });
    }
  }

  function statusClass(status: TestResult["status"]) {
    switch (status) {
      case "success":
        return "border-green-500/40 bg-green-500/10 text-green-300";

      case "error":
        return "border-red-500/40 bg-red-500/10 text-red-300";

      case "loading":
        return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";

      default:
        return "border-white/10 bg-white/5 text-white/60";
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            TOMO — Test Client-Side WeebCentral
          </h1>

          <p className="mt-2 text-sm text-white/60">
            Esta página no utiliza nuestras APIs de Next.js. Todas las pruebas
            salen directamente desde tu navegador.
          </p>
        </div>

        {/* INFO */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-3 text-lg font-semibold">
            Qué estamos probando
          </h2>

          <div className="space-y-2 text-sm text-white/70">
            <p>
              <strong className="text-white">Serie:</strong> fetch directo a
              WeebCentral.
            </p>

            <p>
              <strong className="text-white">Capítulos:</strong> fetch directo
              al full-chapter-list.
            </p>

            <p>
              <strong className="text-white">Imágenes:</strong> fetch directo
              al endpoint de imágenes.
            </p>

            <p>
              <strong className="text-white">Cover:</strong> carga directa
              mediante un elemento IMG.
            </p>

            <p>
              <strong className="text-white">Iframe:</strong> comprobamos si
              WeebCentral puede visualizarse aunque no podamos leer su HTML.
            </p>
          </div>
        </section>

        {/* TEST 1 */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">1. Fetch de la serie</h2>

              <p className="mt-1 break-all text-xs text-white/40">
                {SERIES_URL}
              </p>
            </div>

            <button
              onClick={() =>
                testFetch(
                  SERIES_URL,
                  setSeriesTest,
                  "la página de la serie"
                )
              }
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/80"
            >
              Probar serie
            </button>
          </div>

          <div
            className={`mt-4 rounded-xl border p-4 ${statusClass(
              seriesTest.status
            )}`}
          >
            <div className="font-semibold">{seriesTest.message}</div>

            {seriesTest.details && (
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
                {seriesTest.details}
              </pre>
            )}
          </div>
        </section>

        {/* TEST 2 */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                2. Fetch del full-chapter-list
              </h2>

              <p className="mt-1 break-all text-xs text-white/40">
                {CHAPTER_LIST_URL}
              </p>
            </div>

            <button
              onClick={() =>
                testFetch(
                  CHAPTER_LIST_URL,
                  setChaptersTest,
                  "la lista completa de capítulos"
                )
              }
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/80"
            >
              Probar capítulos
            </button>
          </div>

          <div
            className={`mt-4 rounded-xl border p-4 ${statusClass(
              chaptersTest.status
            )}`}
          >
            <div className="font-semibold">{chaptersTest.message}</div>

            {chaptersTest.details && (
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
                {chaptersTest.details}
              </pre>
            )}
          </div>
        </section>

        {/* TEST 3 */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                3. Fetch del endpoint de imágenes
              </h2>

              <p className="mt-1 break-all text-xs text-white/40">
                {CHAPTER_URL}
              </p>
            </div>

            <button
              onClick={() =>
                testFetch(
                  CHAPTER_URL,
                  setImagesTest,
                  "el endpoint de imágenes"
                )
              }
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/80"
            >
              Probar imágenes
            </button>
          </div>

          <div
            className={`mt-4 rounded-xl border p-4 ${statusClass(
              imagesTest.status
            )}`}
          >
            <div className="font-semibold">{imagesTest.message}</div>

            {imagesTest.details && (
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
                {imagesTest.details}
              </pre>
            )}
          </div>
        </section>

        {/* COVER */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold">
            4. Carga directa del cover
          </h2>

          <p className="mt-1 break-all text-xs text-white/40">
            {COVER_URL}
          </p>

          <div className="mt-4 flex flex-col items-start gap-4">
            <div className="flex h-80 w-56 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black">
              <img
                src={COVER_URL}
                alt="Cover de prueba"
                className="h-full w-full object-cover"
                onLoad={() => {
                  setCoverLoaded(true);
                  setCoverError(false);
                }}
                onError={() => {
                  setCoverLoaded(false);
                  setCoverError(true);
                }}
              />
            </div>

            {coverLoaded && (
              <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-300">
                ✓ La imagen cargó correctamente desde el navegador.
              </div>
            )}

            {coverError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                ✕ El navegador no pudo cargar la imagen.
              </div>
            )}
          </div>
        </section>

        {/* IFRAME */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              5. Iframe de WeebCentral
            </h2>

            <p className="mt-1 text-sm text-white/50">
              Esto NO intenta leer el HTML. Solo queremos comprobar si el
              navegador puede mostrar la página.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
            <iframe
              src={SERIES_URL}
              title="WeebCentral test"
              className="h-[700px] w-full"
            />
          </div>
        </section>
      </div>
    </main>
  );
}