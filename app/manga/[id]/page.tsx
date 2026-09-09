"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useParams,
  useSearchParams,
} from "next/navigation";

import Link from "next/link";

type Chapter = {
  title: string;
  url: string;
  id: string;
};

type MangaData = {
  title: string;
  cover: string;
  synopsis: string;
  totalChapters: number;
  chapters: Chapter[];
};

export default function MangaDetail() {
  const params = useParams();
  const searchParams = useSearchParams();

  const id = params.id as string;
  const chapterFromUrl = searchParams.get("chapter");

  const autoOpenedChapter = useRef(false);

  const [mangaData, setMangaData] =
    useState<MangaData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [searchFilter, setSearchFilter] =
    useState("");

  /* ============================================================
     LECTOR
  ============================================================ */

  const [activeChapter, setActiveChapter] =
    useState<Chapter | null>(null);

  const [lastChapterId, setLastChapterId] =
    useState<string | null>(null);

  const [chapterImages, setChapterImages] =
    useState<string[]>([]);

  const [readerLoading, setReaderLoading] =
    useState(false);

  const [readerError, setReaderError] =
    useState("");

  const [showChapterList, setShowChapterList] =
    useState(false);

  const [chapterSearch, setChapterSearch] =
    useState("");

  const [readerMode, setReaderMode] =
    useState<"vertical" | "page">("page");

  const [currentPage, setCurrentPage] =
    useState(0);

  /* ============================================================
     PROGRESO
  ============================================================ */

  const [readChapters, setReadChapters] =
    useState<string[]>([]);

  /* ============================================================
     CARGAR PROGRESO
  ============================================================ */

  useEffect(() => {
    if (!id) return;

    try {
      const savedRead =
        localStorage.getItem(
          `tomo_read_${id}`
        );

      if (savedRead) {
        const parsedRead =
          JSON.parse(savedRead);

        if (Array.isArray(parsedRead)) {
          setReadChapters(parsedRead);
        }
      }

      const savedLastChapter =
        localStorage.getItem(
          `tomo_last_chapter_${id}`
        );

      if (savedLastChapter) {
        setLastChapterId(savedLastChapter);
      }
    } catch (error) {
      console.error(
        "No se pudo cargar el progreso:",
        error
      );
    }
  }, [id]);

  /* ============================================================
     CARGAR MANGA
  ============================================================ */

  useEffect(() => {
    if (!id) return;

    const fetchMangaDetails = async () => {
      try {
        const targetUrl =
          `https://weebcentral.com/series/${id}`;

        const res = await fetch(
          `/api/manga?url=${encodeURIComponent(
            targetUrl
          )}`
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ||
              "Error al cargar el manga"
          );
        }

        setMangaData({
          title:
            data.title ||
            "Sin título",

          cover:
            data.cover ||
            "",

          synopsis:
            data.synopsis ||
            "",

          totalChapters:
            data.totalChapters ??
            data.chapters?.length ??
            0,

          chapters:
            Array.isArray(
              data.chapters
            )
              ? data.chapters
              : [],
        });
      } catch (err: any) {
        setError(
          err.message ||
            "Error al cargar el manga"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMangaDetails();
  }, [id]);

  /* ============================================================
     MARCAR / DESMARCAR COMO LEÍDO
  ============================================================ */

  const toggleChapterRead = (
    chapterId: string
  ) => {
    setReadChapters((previous) => {
      const alreadyRead =
        previous.includes(
          chapterId
        );

      const updated =
        alreadyRead
          ? previous.filter(
              (chapter) =>
                chapter !== chapterId
            )
          : [
              ...previous,
              chapterId,
            ];

      localStorage.setItem(
        `tomo_read_${id}`,
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  /* ============================================================
     MARCAR AUTOMÁTICAMENTE COMO LEÍDO
  ============================================================ */

  const markChapterAsRead = (
    chapterId: string
  ) => {
    setReadChapters((previous) => {
      if (
        previous.includes(
          chapterId
        )
      ) {
        return previous;
      }

      const updated = [
        ...previous,
        chapterId,
      ];

      localStorage.setItem(
        `tomo_read_${id}`,
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  /* ============================================================
     OBTENER NÚMERO DE CAPÍTULO
  ============================================================ */

  const getChapterNumber = (
    chapter: Chapter
  ) => {
    const match =
      chapter.title.match(
        /\d+(?:\.\d+)?/
      );

    if (!match) return null;

    const number =
      parseFloat(match[0]);

    return Number.isNaN(number)
      ? null
      : number;
  };

  /* ============================================================
     CAPÍTULOS ORDENADOS NUMÉRICAMENTE
  ============================================================ */

  const orderedChapters =
    useMemo(() => {
      if (!mangaData?.chapters) {
        return [];
      }

      return mangaData.chapters
        .map((chapter, index) => ({
          chapter,
          index,
        }))
        .sort((a, b) => {
          const numA =
            getChapterNumber(
              a.chapter
            );

          const numB =
            getChapterNumber(
              b.chapter
            );

          if (
            numA === null &&
            numB === null
          ) {
            return a.index - b.index;
          }

          if (numA === null) return 1;
          if (numB === null) return -1;

          if (numA === numB) {
            return a.index - b.index;
          }

          return numA - numB;
        })
        .map(
          (item) => item.chapter
        );
    }, [mangaData]);

  /* ============================================================
     CAPÍTULOS PARA MOSTRAR EN LA LISTA
     EL ACTUAL / ÚLTIMO LEÍDO VA PRIMERO
  ============================================================ */

  const displayChapters =
    useMemo(() => {
      if (
        orderedChapters.length === 0
      ) {
        return [];
      }

      const priorityId =
        activeChapter?.id ??
        lastChapterId;

      if (!priorityId) {
        return orderedChapters;
      }

      const priorityChapter =
        orderedChapters.find(
          (chapter) =>
            chapter.id === priorityId
        );

      if (!priorityChapter) {
        return orderedChapters;
      }

      return [
        priorityChapter,
        ...orderedChapters.filter(
          (chapter) =>
            chapter.id !== priorityId
        ),
      ];
    }, [
      orderedChapters,
      activeChapter,
      lastChapterId,
    ]);

  /* ============================================================
     ABRIR CAPÍTULO
  ============================================================ */

  const openBuiltInReader = async (
    chapter: Chapter
  ) => {
    localStorage.setItem(
      `tomo_last_chapter_${id}`,
      chapter.id
    );

    setLastChapterId(
      chapter.id
    );

    let savedPage = 0;

    try {
      const saved =
        localStorage.getItem(
          `tomo_page_${id}_${chapter.id}`
        );

      if (saved !== null) {
        const parsed =
          Number(saved);

        if (
          Number.isInteger(parsed) &&
          parsed >= 0
        ) {
          savedPage = parsed;
        }
      }
    } catch {
      savedPage = 0;
    }

    setActiveChapter(chapter);
    setChapterImages([]);
    setCurrentPage(savedPage);
    setReaderError("");
    setReaderLoading(true);
    setShowChapterList(false);

    try {
      const res = await fetch(
        `/api/manga?type=chapter&url=${encodeURIComponent(
          chapter.url
        )}`
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "No se pudieron cargar las páginas"
        );
      }

      const images =
        Array.isArray(
          data.images
        )
          ? data.images
          : [];

      if (images.length === 0) {
        throw new Error(
          "WeebCentral no devolvió ninguna página."
        );
      }

      setChapterImages(images);

      setCurrentPage(
        Math.min(
          savedPage,
          images.length - 1
        )
      );
    } catch (err: any) {
      console.error(
        "Error cargando capítulo:",
        err
      );

      setReaderError(
        err.message ||
          "No se pudo cargar el capítulo"
      );
    } finally {
      setReaderLoading(false);
    }
  };

  /* ============================================================
     GUARDAR PÁGINA ACTUAL
  ============================================================ */

  useEffect(() => {
    if (!activeChapter) return;
    if (readerMode !== "page") return;
    if (chapterImages.length === 0) return;

    try {
      localStorage.setItem(
        `tomo_page_${id}_${activeChapter.id}`,
        String(currentPage)
      );
    } catch (error) {
      console.error(
        "No se pudo guardar la página:",
        error
      );
    }
  }, [
    id,
    activeChapter,
    currentPage,
    chapterImages.length,
    readerMode,
  ]);

  /* ============================================================
     ABRIR AUTOMÁTICAMENTE DESDE ?chapter=
  ============================================================ */

  useEffect(() => {
    if (
      !mangaData ||
      !chapterFromUrl ||
      autoOpenedChapter.current
    ) {
      return;
    }

    const chapter =
      mangaData.chapters.find(
        (item) =>
          item.id ===
          chapterFromUrl
      );

    if (!chapter) return;

    autoOpenedChapter.current =
      true;

    openBuiltInReader(chapter);
  }, [
    mangaData,
    chapterFromUrl,
  ]);

  /* ============================================================
     SIGUIENTE CAPÍTULO
  ============================================================ */

  const nextChapter = () => {
    if (!activeChapter) return;

    const currentIndex =
      orderedChapters.findIndex(
        (chapter) =>
          chapter.id ===
          activeChapter.id
      );

    if (
      currentIndex === -1 ||
      currentIndex >=
        orderedChapters.length - 1
    ) {
      return;
    }

    const next =
      orderedChapters[
        currentIndex + 1
      ];

    markChapterAsRead(
      activeChapter.id
    );

    openBuiltInReader(next);
  };

  /* ============================================================
     CAPÍTULO ANTERIOR
  ============================================================ */

  const previousChapter = () => {
    if (!activeChapter) return;

    const currentIndex =
      orderedChapters.findIndex(
        (chapter) =>
          chapter.id ===
          activeChapter.id
      );

    if (
      currentIndex <= 0
    ) {
      return;
    }

    const previous =
      orderedChapters[
        currentIndex - 1
      ];

    openBuiltInReader(previous);
  };

  /* ============================================================
     CERRAR LECTOR
  ============================================================ */

  const closeReader = () => {
    setActiveChapter(null);
    setChapterImages([]);
    setReaderError("");
    setShowChapterList(false);
    setReaderLoading(false);
  };

  /* ============================================================
     CAMBIAR PÁGINA
  ============================================================ */

  const previousPage = () => {
    setCurrentPage((previous) =>
      Math.max(
        previous - 1,
        0
      )
    );
  };

  const nextPage = () => {
    setCurrentPage((previous) => {
      if (
        previous >=
        chapterImages.length - 1
      ) {
        return previous;
      }

      return previous + 1;
    });
  };

  /* ============================================================
     TECLADO
  ============================================================ */

  useEffect(() => {
    if (!activeChapter) return;

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        closeReader();
        return;
      }

      if (
        readerMode !== "page"
      ) {
        return;
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "PageUp"
      ) {
        event.preventDefault();
        previousPage();
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "PageDown"
      ) {
        event.preventDefault();
        nextPage();
      }

      if (
        event.key === "Home"
      ) {
        event.preventDefault();
        setCurrentPage(0);
      }

      if (
        event.key === "End"
      ) {
        event.preventDefault();

        setCurrentPage(
          Math.max(
            chapterImages.length - 1,
            0
          )
        );
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    activeChapter,
    readerMode,
    chapterImages.length,
  ]);

  /* ============================================================
     FILTRO
  ============================================================ */

  const filteredChapters =
    useMemo(() => {
      return displayChapters.filter(
        (chapter) =>
          chapter.title
            .toLowerCase()
            .includes(
              searchFilter.toLowerCase()
            )
      );
    }, [
      displayChapters,
      searchFilter,
    ]);

  /* ============================================================
     CAPÍTULOS DEL DRAWER
  ============================================================ */

  const readerChapters =
    displayChapters.filter(
      (chapter) =>
        chapter.title
          .toLowerCase()
          .includes(
            chapterSearch.toLowerCase()
          )
    );

  /* ============================================================
     ÍNDICE DEL CAPÍTULO ACTUAL
  ============================================================ */

  const activeChapterIndex =
    activeChapter
      ? orderedChapters.findIndex(
          (chapter) =>
            chapter.id ===
            activeChapter.id
        )
      : -1;

  const hasPreviousChapter =
    activeChapterIndex > 0;

  const hasNextChapter =
    activeChapterIndex !== -1 &&
    activeChapterIndex <
      orderedChapters.length - 1;

  /* ============================================================
     PROGRESO TOTAL
  ============================================================ */

  const progress =
    mangaData &&
    mangaData.chapters.length > 0
      ? Math.round(
          (readChapters.length /
            mangaData.chapters.length) *
            100
        )
      : 0;

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <p className="text-pink-500 font-medium animate-pulse">
          Cargando TOMO...
        </p>
      </div>
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">
          {error}
        </p>

        <Link
          href="/"
          className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
        >
          Volver a la Biblioteca
        </Link>
      </div>
    );
  }

  /* ============================================================
     LECTOR
  ============================================================ */

  if (activeChapter) {
    return (
      <div className="fixed inset-0 bg-neutral-950 text-neutral-100 z-50 flex flex-col">

        {/* ======================================================
           HEADER
        ====================================================== */}

        <header className="bg-neutral-900 border-b border-neutral-800 px-3 md:px-6 py-3 flex items-center justify-between gap-3 shrink-0">

          {/* CAPÍTULO ACTUAL */}

          <div className="min-w-0 flex items-center gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate text-white">
                {activeChapter.title}
              </h2>
            </div>
          </div>

          {/* CONTROLES */}

          <div className="flex items-center gap-1.5 shrink-0">

            {/* MODO DE LECTURA */}

            <button
              onClick={() => {
                setReaderMode(
                  readerMode ===
                    "vertical"
                    ? "page"
                    : "vertical"
                );
              }}
              className="h-9 px-3 rounded-lg text-xs font-bold border bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white hover:bg-neutral-700 transition-colors"
              title="Cambiar modo de lectura"
            >
              <span className="hidden sm:inline">
                {readerMode ===
                "vertical"
                  ? "Página por página"
                  : "Vertical"}
              </span>

              <span className="sm:hidden">
                {readerMode ===
                "vertical"
                  ? "▣"
                  : "☰"}
              </span>
            </button>

            {/* CAPÍTULOS */}

            <button
              onClick={() =>
                setShowChapterList(
                  !showChapterList
                )
              }
              className={`h-9 flex items-center gap-1.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                showChapterList
                  ? "bg-pink-500 text-white border-pink-500"
                  : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white hover:bg-neutral-700"
              }`}
              title="Abrir capítulos"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line
                  x1="8"
                  y1="6"
                  x2="21"
                  y2="6"
                />

                <line
                  x1="8"
                  y1="12"
                  x2="21"
                  y2="12"
                />

                <line
                  x1="8"
                  y1="18"
                  x2="21"
                  y2="18"
                />

                <line
                  x1="3"
                  y1="6"
                  x2="3.01"
                  y2="6"
                />

                <line
                  x1="3"
                  y1="12"
                  x2="3.01"
                  y2="12"
                />

                <line
                  x1="3"
                  y1="18"
                  x2="3.01"
                  y2="18"
                />
              </svg>

              <span className="hidden sm:inline">
                Capítulos
              </span>
            </button>

            {/* LEÍDO */}

            <button
              onClick={() =>
                toggleChapterRead(
                  activeChapter.id
                )
              }
              className={`hidden sm:block h-9 px-3 rounded-lg text-xs font-bold border transition-colors ${
                readChapters.includes(activeChapter.id)
                  ? "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                  : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white hover:bg-neutral-700"
              }`}
            >
              {readChapters.includes(
                activeChapter.id
              )
                ? "✓ Leído"
                : "Marcar leído"}
            </button>

            {/* CERRAR */}

            <button
              onClick={closeReader}
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 transition-all duration-200"
              title="Cerrar lector"
              aria-label="Cerrar lector"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line
                  x1="6"
                  y1="6"
                  x2="18"
                  y2="18"
                />

                <line
                  x1="18"
                  y1="6"
                  x2="6"
                  y2="18"
                />
              </svg>
            </button>

          </div>
        </header>

        {/* ======================================================
           DRAWER
        ====================================================== */}

        {showChapterList && (
          <div className="absolute inset-0 z-40">

            <button
              onClick={() =>
                setShowChapterList(
                  false
                )
              }
              className="absolute inset-0 bg-black/60 cursor-default"
              aria-label="Cerrar lista"
            />

            <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-96 bg-neutral-950 border-l border-neutral-800 shadow-2xl flex flex-col">

              <div className="px-4 py-4 border-b border-neutral-800 shrink-0">

                <div className="flex items-center justify-between gap-3 mb-3">

                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Capítulos
                    </h3>

                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {orderedChapters.length}{" "}
                      capítulos
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setShowChapterList(
                        false
                      )
                    }
                    className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
                    title="Cerrar capítulos"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line
                        x1="6"
                        y1="6"
                        x2="18"
                        y2="18"
                      />

                      <line
                        x1="18"
                        y1="6"
                        x2="6"
                        y2="18"
                      />
                    </svg>
                  </button>

                </div>

                <input
                  type="text"
                  placeholder="Buscar capítulo..."
                  value={
                    chapterSearch
                  }
                  onChange={(e) =>
                    setChapterSearch(
                      e.target.value
                    )
                  }
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-xl text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-pink-500"
                />

              </div>

              <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-3">

                <div className="space-y-1.5">

                  {readerChapters.length ===
                  0 ? (
                    <p className="text-xs text-neutral-500 text-center py-8">
                      No se encontró ningún
                      capítulo.
                    </p>
                  ) : (
                    readerChapters.map(
                      (chapter) => {
                        const isActive =
                          chapter.id ===
                          activeChapter.id;

                        const isRead =
                          readChapters.includes(
                            chapter.id
                          );

                        return (
                          <button
                            key={
                              chapter.id
                            }
                            onClick={() =>
                              openBuiltInReader(
                                chapter
                              )
                            }
                            className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                              isActive
                                ? "bg-pink-500/10 border-pink-500/40"
                                : isRead
                                ? "bg-green-500/[0.03] border-green-500/10 hover:border-green-500/30"
                                : "bg-neutral-900 border-neutral-800 hover:border-pink-500/30 hover:bg-neutral-900/80"
                            }`}
                          >
                            <div className="min-w-0">

                              <p
                                className={`text-xs font-semibold truncate ${
                                  isActive
                                    ? "text-pink-400"
                                    : "text-neutral-200"
                                }`}
                              >
                                {
                                  chapter.title
                                }
                              </p>

                              {isActive && (
                                <p className="text-[10px] text-pink-500/70 mt-0.5">
                                  Leyendo ahora
                                </p>
                              )}

                            </div>

                            <div className="shrink-0">

                              {isActive ? (
                                <span className="text-pink-400 text-xs font-bold">
                                  ●
                                </span>
                              ) : isRead ? (
                                <span className="text-green-400 text-xs font-bold">
                                  ✓
                                </span>
                              ) : (
                                <span className="text-neutral-700 text-xs">
                                  ○
                                </span>
                              )}

                            </div>
                          </button>
                        );
                      }
                    )
                  )}

                </div>
              </div>

            </aside>
          </div>
        )}

        {/* ======================================================
           CONTENIDO DEL LECTOR
        ====================================================== */}

        <div className="tomo-reader-scroll relative flex-1 min-h-0 bg-black overflow-y-auto overflow-x-hidden">

          {readerLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
              <p className="text-pink-500 font-medium animate-pulse">
                Cargando capítulo...
              </p>
            </div>
          )}

          {readerError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black">

              <p className="text-red-400 text-sm">
                {readerError}
              </p>

              <button
                onClick={() => {
                  openBuiltInReader(
                    activeChapter
                  );
                }}
                className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                Reintentar
              </button>

            </div>
          )}

          {/* MODO VERTICAL */}

          {readerMode ===
            "vertical" &&
            !readerLoading &&
            !readerError && (
              <div className="w-full flex flex-col items-center">

                {chapterImages.map(
                  (image, index) => (
                    <img
                      key={`${activeChapter.id}-${index}`}
                      src={image}
                      alt={`Página ${index + 1}`}
                      className="block w-full max-w-[1000px] h-auto"
                      loading={
                        index < 3
                          ? "eager"
                          : "lazy"
                      }
                      draggable={false}
                    />
                  )
                )}

              </div>
            )}

          {/* MODO PÁGINA POR PÁGINA */}

          {readerMode ===
            "page" &&
            !readerLoading &&
            !readerError &&
            chapterImages.length > 0 && (
              <div className="w-full h-full flex items-center justify-center bg-black">

                <div className="w-full h-full flex items-center justify-center px-2 md:px-12 py-4">

                  <img
                    src={
                      chapterImages[
                        currentPage
                      ]
                    }
                    alt={`Página ${
                      currentPage + 1
                    }`}
                    className="max-w-full max-h-full object-contain select-none"
                    draggable={false}
                  />

                </div>
              </div>
            )}

        </div>

        {/* ======================================================
           FOOTER DEL LECTOR
        ====================================================== */}

        <footer className="bg-neutral-900 border-t border-neutral-800 px-3 py-2.5 shrink-0">

          <div className="flex items-center justify-between max-w-5xl mx-auto gap-3">

            {/* ANTERIOR */}

            <button
              disabled={
                readerMode ===
                "page"
                  ? currentPage === 0
                  : !hasPreviousChapter
              }
              onClick={() => {
                if (
                  readerMode ===
                  "page"
                ) {
                  previousPage();
                  return;
                }

                previousChapter();
              }}
              className="min-w-[105px] h-9 inline-flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 rounded-lg text-xs font-bold transition-colors"
            >
              Anterior
            </button>

            {/* INDICADOR */}

            <span className="min-w-[70px] text-xs text-neutral-400 text-center tabular-nums">

              {readerMode ===
              "page"
                ? `${currentPage + 1} / ${chapterImages.length}`
                : `${activeChapterIndex + 1} / ${orderedChapters.length}`}

            </span>

            {/* SIGUIENTE */}

            <button
              disabled={
                readerMode ===
                "page"
                  ? currentPage >=
                    chapterImages.length - 1
                  : !hasNextChapter
              }
              onClick={() => {
                if (
                  readerMode ===
                  "page"
                ) {
                  nextPage();
                  return;
                }

                nextChapter();
              }}
              className="min-w-[105px] h-9 inline-flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 rounded-lg text-xs font-bold transition-colors"
            >
              Siguiente
            </button>

          </div>
        </footer>

      </div>
    );
  }

  /* ============================================================
     PÁGINA DEL MANGA
  ============================================================ */

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12 relative">

      <div className="max-w-4xl mx-auto space-y-8">

        {/* ======================================================
           HEADER
        ====================================================== */}

        <div className="flex justify-between items-center">

          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-pink-500/40 text-neutral-300 hover:text-pink-400 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group"
          >
            Volver a la biblioteca
          </Link>

          <span className="text-3xl sm:text-4xl font-black tracking-[-0.09em] leading-none text-white">
            TOM
            <span className="text-pink-500">
              O
            </span>
          </span>

        </div>

        {mangaData && (
          <div className="space-y-8">

            {/* ==================================================
               INFORMACIÓN
            ================================================== */}

            <div className="flex flex-col md:flex-row gap-6 bg-neutral-900/50 p-6 rounded-2xl border border-neutral-800 backdrop-blur">

              {mangaData.cover && (
                <img
                  src={
                    mangaData.cover
                  }
                  alt={
                    mangaData.title
                  }
                  className="w-48 h-72 object-cover rounded-xl shadow-md mx-auto md:mx-0 border border-neutral-700"
                />
              )}

              <div className="space-y-3 flex-1 text-center md:text-left">

                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {mangaData.title}
                </h1>

                <p className="text-neutral-400 text-sm leading-relaxed">
                  {
                    mangaData.synopsis
                  }
                </p>

                <div className="flex flex-wrap gap-2 justify-center md:justify-start">

                  <div className="inline-block bg-neutral-800 px-4 py-1.5 rounded-full text-xs font-semibold text-pink-400 border border-neutral-700">
                    {
                      mangaData
                        .chapters
                        .length
                    }{" "}
                    Capítulos totales
                  </div>

                  <div className="inline-block bg-neutral-800 px-4 py-1.5 rounded-full text-xs font-semibold text-green-400 border border-neutral-700">
                    {
                      readChapters.length
                    }{" "}
                    Leídos
                  </div>

                </div>

                <div className="pt-2">

                  <div className="flex justify-between text-[11px] text-neutral-500 mb-1">

                    <span>
                      Progreso
                    </span>

                    <span>
                      {progress}%
                    </span>

                  </div>

                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-pink-500 transition-all"
                      style={{
                        width: `${progress}%`,
                      }}
                    />

                  </div>
                </div>

              </div>
            </div>

            {/* ==================================================
               CAPÍTULOS
            ================================================== */}

            <div className="space-y-4">

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-neutral-800 pb-4">

                <h3 className="text-xl font-bold">
                  Capítulos
                </h3>

                <div className="relative w-full sm:w-60">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none"
                  >
                    <circle
                      cx="11"
                      cy="11"
                      r="7"
                    />

                    <path
                      strokeLinecap="round"
                      d="m20 20-4-4"
                    />
                  </svg>

                  <input
                    type="text"
                    placeholder="Buscar capítulo..."
                    value={searchFilter}
                    onChange={(e) =>
                      setSearchFilter(e.target.value)
                    }
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-pink-500/50 outline-none rounded-xl pl-10 pr-3 py-3 text-xs text-white placeholder:text-neutral-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-2">

                {filteredChapters.length ===
                0 ? (
                  <p className="text-xs text-neutral-500 col-span-2 text-center py-8">
                    No se encontró ningún
                    capítulo con ese filtro.
                  </p>
                ) : (
                  filteredChapters.map(
                    (chapter) => {

                      const isRead =
                        readChapters.includes(
                          chapter.id
                        );

                      const isCurrent = lastChapterId === chapter.id;

                      return (
                        <div
                          key={
                            chapter.id
                          }
                          className={`flex justify-between items-center bg-neutral-900 border p-4 rounded-xl transition-all group ${
                            isCurrent
                              ? "border-pink-500/40 bg-pink-500/[0.05]"
                              : isRead
                              ? "border-green-500/20"
                              : "border-neutral-800 hover:border-pink-500/50"
                          }`}
                        >

                          <button
                            onClick={() =>
                              openBuiltInReader(
                                chapter
                              )
                            }
                            className="font-medium text-sm text-neutral-200 group-hover:text-pink-400 transition-colors flex-1 truncate mr-2 text-left cursor-pointer"
                          >

                            {isRead && (
                              <span className="text-green-400 mr-2">
                                ✓
                              </span>
                            )}

                            {isCurrent &&
                              !isRead && (
                                <span className="text-pink-400 mr-2">
                                  ●
                                </span>
                            )}

                            {
                              chapter.title
                            }

                          </button>

                          <div className="flex items-center gap-2 shrink-0">

                            <button
                              onClick={() =>
                                toggleChapterRead(
                                  chapter.id
                                )
                              }
                              className={`text-xs px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                                isRead
                                  ? "text-green-400 border-green-500/30 bg-green-500/10 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10"
                                  : "text-neutral-400 border-neutral-800 bg-neutral-950 hover:text-pink-400 hover:border-pink-500/40"
                              }`}
                              title={
                                isRead
                                  ? "Desmarcar como leído"
                                  : "Marcar como leído"
                              }
                            >
                              {isRead
                                ? "✓ Leído"
                                : "Marcar"}
                            </button>

                          </div>
                        </div>
                      );
                    }
                  )
                )}

              </div>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}