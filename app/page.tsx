'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface MangaItem {
  id: string;
  title: string;
  cover: string;
  url: string;
}

interface Chapter {
  id: string;
  title: string;
  url: string;
}

interface MangaProgress {
  readCount: number;
  totalChapters: number;
  progress: number;
  lastChapterId: string | null;
  lastChapterTitle: string | null;
  lastPage: number | null;
}

export default function Home() {
  const [urlInput, setUrlInput] = useState('');
  const [library, setLibrary] = useState<MangaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<
    'recent' | 'name' | 'progress'
  >('recent');

  const [progressData, setProgressData] = useState<
    Record<string, MangaProgress>
  >({});

  /* =========================
     CARGAR BIBLIOTECA
  ========================= */

  useEffect(() => {
    const saved = localStorage.getItem('my_manga_library');

    if (!saved) return;

    try {
      setLibrary(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
  }, []);

  /* =========================
     CARGAR PROGRESO
  ========================= */

  useEffect(() => {
    if (library.length === 0) {
      setProgressData({});
      return;
    }

    let cancelled = false;

    const loadProgress = async () => {
      const results = await Promise.all(
        library.map(async (manga) => {
          try {
            const savedRead = localStorage.getItem(
              `tomo_read_${manga.id}`
            );

            const savedPages = localStorage.getItem(
              `tomo_pages_${manga.id}`
            );

            const savedLastChapter = localStorage.getItem(
              `tomo_last_chapter_${manga.id}`
            );

            const readChapters: string[] = savedRead
              ? JSON.parse(savedRead)
              : [];

            const savedPageData: Record<string, number> =
              savedPages ? JSON.parse(savedPages) : {};

            const res = await fetch(
              `/api/manga?url=${encodeURIComponent(manga.url)}`
            );

            const data = await res.json();

            if (!res.ok) {
              throw new Error(
                data.error || 'No se pudo cargar el progreso'
              );
            }

            const chapters: Chapter[] = data.chapters || [];

            const totalChapters = chapters.length;
            const readCount = readChapters.length;

            const progress =
              totalChapters > 0
                ? Math.min(
                    100,
                    Math.round((readCount / totalChapters) * 100)
                  )
                : 0;

            let lastChapter: Chapter | null = null;
            let lastPage: number | null = null;

            /*
             * PRIMERO:
             * capítulo abierto más recientemente.
             */
            if (savedLastChapter) {
              lastChapter =
                chapters.find(
                  (chapter) => chapter.id === savedLastChapter
                ) || null;

              if (lastChapter) {
                if (
                  savedPageData[lastChapter.id] !== undefined
                ) {
                  lastPage = savedPageData[lastChapter.id];
                }
              }
            }

            /*
             * RESPALDO:
             * capítulo con página guardada más reciente.
             */
            if (!lastChapter) {
              for (const chapter of chapters) {
                if (
                  savedPageData[chapter.id] !== undefined
                ) {
                  lastChapter = chapter;
                  lastPage = savedPageData[chapter.id];
                }
              }
            }

            /*
             * ÚLTIMO RESPALDO:
             * último capítulo leído.
             */
            if (!lastChapter && readCount > 0) {
              for (let i = chapters.length - 1; i >= 0; i--) {
                if (readChapters.includes(chapters[i].id)) {
                  lastChapter = chapters[i];
                  break;
                }
              }
            }

            return [
              manga.id,
              {
                readCount,
                totalChapters,
                progress,
                lastChapterId: lastChapter?.id || null,
                lastChapterTitle: lastChapter?.title || null,
                lastPage,
              },
            ] as const;
          } catch (e) {
            console.error(
              `Error cargando ${manga.title}`,
              e
            );

            return [
              manga.id,
              {
                readCount: 0,
                totalChapters: 0,
                progress: 0,
                lastChapterId: null,
                lastChapterTitle: null,
                lastPage: null,
              },
            ] as const;
          }
        })
      );

      if (cancelled) return;

      const result: Record<string, MangaProgress> =
        Object.fromEntries(results);

      setProgressData(result);
    };

    loadProgress();

    return () => {
      cancelled = true;
    };
  }, [library]);

  /* =========================
     AÑADIR MANGA
  ========================= */

  const handleAddManga = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!urlInput.trim()) return;

    setLoading(true);
    setError('');

    try {
      const cleanUrl = urlInput.trim();

      const res = await fetch(
        `/api/manga?url=${encodeURIComponent(cleanUrl)}`
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || 'No se pudo agregar el manga'
        );
      }

      const match = cleanUrl.match(
        /\/series\/([a-zA-Z0-9]+)/
      );

      if (!match) {
        throw new Error('Link de serie inválido');
      }

      const seriesId = match[1];

      if (
        library.some(
          (item) => item.id === seriesId
        )
      ) {
        throw new Error(
          'Este manga ya está en tu biblioteca'
        );
      }

      /*
       * IMPORTANTE:
       * El API devuelve directamente:
       *
       * data.title
       * data.cover
       *
       * No existe data.manga.
       */
      const newItem: MangaItem = {
        id: seriesId,
        title: data.title,
        cover: data.cover,
        url: cleanUrl,
      };

      const updatedLibrary = [
        newItem,
        ...library,
      ];

      setLibrary(updatedLibrary);

      localStorage.setItem(
        'my_manga_library',
        JSON.stringify(updatedLibrary)
      );

      setUrlInput('');
      setError('');
      setIsModalOpen(false);
    } catch (err: any) {
      setError(
        err?.message || 'Ocurrió un error'
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     ELIMINAR MANGA
  ========================= */

  const handleRemove = (
    id: string,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const updated = library.filter(
      (item) => item.id !== id
    );

    setLibrary(updated);

    localStorage.setItem(
      'my_manga_library',
      JSON.stringify(updated)
    );
  };

  /* =========================
     CONTINUAR LEYENDO
  ========================= */

  const continueReading = useMemo(() => {
    return library
      .filter((manga) => {
        const data = progressData[manga.id];

        return (
          data &&
          data.totalChapters > 0 &&
          data.progress > 0 &&
          data.progress < 100 &&
          data.lastChapterId
        );
      })
      .sort((a, b) => {
        const aData = progressData[a.id];
        const bData = progressData[b.id];

        return (
          (bData?.progress || 0) -
          (aData?.progress || 0)
        );
      });
  }, [library, progressData]);

  /* =========================
     FILTRAR / ORDENAR
  ========================= */

  const filteredLibrary = useMemo(() => {
    let result = library.filter((manga) =>
      manga.title
        .toLowerCase()
        .includes(search.toLowerCase())
    );

    if (sortOrder === 'name') {
      result.sort((a, b) =>
        a.title.localeCompare(b.title)
      );
    }

    if (sortOrder === 'progress') {
      result.sort(
        (a, b) =>
          (progressData[b.id]?.progress || 0) -
          (progressData[a.id]?.progress || 0)
      );
    }

    return result;
  }, [
    library,
    search,
    sortOrder,
    progressData,
  ]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-5 md:px-10 py-5 sm:py-6 md:py-8">

        {/* HEADER */}

        <header className="flex items-center justify-between gap-4 border-b border-neutral-900 pb-4 sm:pb-5">
          <Link
            href="/"
            className="group shrink-0"
          >
            <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.09em] leading-none text-white">
              TOM
              <span className="text-pink-500 group-hover:text-pink-400 transition-colors">
                O
              </span>
            </h1>
          </Link>

          <button
            onClick={() => {
              setIsModalOpen(true);
              setError('');
            }}
            className="shrink-0 flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 active:scale-95 text-white font-bold px-3.5 sm:px-4 py-2.5 rounded-xl transition-all text-sm shadow-lg shadow-pink-500/10 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                d="M12 5v14M5 12h14"
              />
            </svg>

            <span className="hidden sm:inline">
              Añadir Manga
            </span>

            <span className="sm:hidden">
              Añadir
            </span>
          </button>
        </header>

        {/* CONTINUAR LEYENDO */}

        {continueReading.length > 0 && (
          <section className="mt-8 sm:mt-10 md:mt-12">
            <div className="mb-4 sm:mb-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-pink-500 font-bold mb-1.5">
                Tu lectura
              </p>

              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Continuar leyendo
              </h2>
            </div>

            {(() => {
              const manga = continueReading[0];
              const data = progressData[manga.id];

              if (
                !data ||
                !data.lastChapterId
              ) {
                return null;
              }

              return (
                <Link
                  href={`/manga/${manga.id}?chapter=${encodeURIComponent(
                    data.lastChapterId
                  )}`}
                  className="group relative block overflow-hidden rounded-2xl sm:rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl hover:border-pink-500/40 transition-all duration-300"
                >
                  {manga.cover && (
                    <img
                      src={manga.cover}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-15 sm:opacity-20 group-hover:opacity-25 transition-opacity duration-500"
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/95 to-neutral-950/70 sm:to-neutral-950/65" />

                  <div className="relative z-10 flex flex-col sm:flex-row min-h-0 sm:min-h-[300px] md:min-h-[350px]">

                    {/* PORTADA */}

                    <div className="w-full sm:w-40 md:w-56 shrink-0 p-4 sm:p-5 md:p-6">
                      <div className="w-32 sm:w-full mx-auto aspect-[3/4] sm:aspect-auto sm:h-full rounded-xl sm:rounded-2xl overflow-hidden bg-neutral-950 border border-white/10 shadow-2xl">
                        {manga.cover ? (
                          <img
                            src={manga.cover}
                            alt={manga.title}
                            className="w-full h-full object-cover group-hover:scale-[1.035] transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full min-h-40 flex items-center justify-center text-xs text-neutral-500">
                            Sin portada
                          </div>
                        )}
                      </div>
                    </div>

                    {/* INFORMACIÓN */}

                    <div className="flex-1 flex flex-col justify-center px-4 pb-5 sm:px-0 sm:py-8 sm:pr-6 md:pr-12 min-w-0 text-center sm:text-left">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500 font-bold mb-2">
                        Continúa con
                      </p>

                      <h3 className="text-2xl sm:text-2xl md:text-4xl font-black leading-tight text-white max-w-2xl line-clamp-2">
                        {manga.title}
                      </h3>

                      <div className="mt-3 sm:mt-4">
                        <p className="text-sm md:text-base font-semibold text-neutral-300 line-clamp-1">
                          {data.lastChapterTitle ||
                            'Último capítulo'}
                        </p>

                        {data.lastPage !== null && (
                          <p className="text-xs text-neutral-500 mt-1">
                            Página {data.lastPage + 1}
                          </p>
                        )}
                      </div>

                      <div className="w-full max-w-xl mx-auto sm:mx-0 mt-5 sm:mt-6">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-neutral-400">
                            {data.readCount} de{' '}
                            {data.totalChapters} capítulos
                          </span>

                          <span className="text-pink-400 font-bold">
                            {data.progress}%
                          </span>
                        </div>

                        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-pink-500 rounded-full"
                            style={{
                              width: `${data.progress}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-5 sm:mt-7">
                        <span className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-pink-500 group-hover:bg-pink-600 text-white text-xs font-black px-5 py-3 rounded-xl transition-colors">
                          Continuar leyendo

                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 12h14m-6-6 6 6-6 6"
                            />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })()}
          </section>
        )}

        {/* BIBLIOTECA */}

        <section
          className={
            continueReading.length > 0
              ? 'mt-12 sm:mt-14 md:mt-16'
              : 'mt-8 sm:mt-10 md:mt-12'
          }
        >
          <div className="mb-6 sm:mb-7">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 font-bold mb-1.5">
                  Colección
                </p>

                <div className="flex items-baseline gap-3">
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Mi biblioteca
                  </h2>

                  {library.length > 0 && (
                    <span className="text-xs text-neutral-600 font-medium">
                      {library.length}{' '}
                      {library.length === 1
                        ? 'manga'
                        : 'mangas'}
                    </span>
                  )}
                </div>
              </div>

              {library.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">

                  {/* BUSCAR */}

                  <div className="relative flex-1 sm:flex-none">
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
                      placeholder="Buscar manga..."
                      value={search}
                      onChange={(e) =>
                        setSearch(e.target.value)
                      }
                      className="w-full sm:w-60 bg-neutral-900 border border-neutral-800 focus:border-pink-500/50 outline-none rounded-xl pl-10 pr-3 py-3 text-xs text-white placeholder:text-neutral-500 transition-colors"
                    />
                  </div>

                  {/* ORDENAR */}

                  <div className="relative sm:w-44">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 6h12M8 12h8M8 18h4M4 6h.01M4 12h.01M4 18h.01"
                      />
                    </svg>

                    <select
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(
                          e.target.value as
                            | 'recent'
                            | 'name'
                            | 'progress'
                        )
                      }
                      className="appearance-none w-full bg-neutral-900 border border-neutral-800 focus:border-pink-500/50 outline-none rounded-xl pl-10 pr-9 py-3 text-xs text-neutral-400 cursor-pointer"
                    >
                      <option value="recent">
                        Más recientes
                      </option>

                      <option value="name">
                        Nombre
                      </option>

                      <option value="progress">
                        Progreso
                      </option>
                    </select>

                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m6 9 6 6 6-6"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* EMPTY */}

          {library.length === 0 ? (
            <div className="relative overflow-hidden text-center py-20 sm:py-28 px-5 border border-dashed border-neutral-900 rounded-2xl sm:rounded-3xl">
              <div className="absolute inset-0 bg-gradient-to-b from-pink-500/[0.025] to-transparent" />

              <div className="relative">
                <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"
                    />

                    <path
                      strokeLinecap="round"
                      d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
                    />
                  </svg>
                </div>

                <p className="text-sm font-bold text-neutral-400">
                  Tu biblioteca está vacía
                </p>

                <p className="text-xs text-neutral-500 mt-2 max-w-xs mx-auto">
                  Añade tu primer manga para comenzar tu colección.
                </p>

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-6 inline-flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-pink-500/30 text-neutral-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="w-3.5 h-3.5"
                  >
                    <path
                      strokeLinecap="round"
                      d="M12 5v14M5 12h14"
                    />
                  </svg>

                  Añadir manga
                </button>
              </div>
            </div>
          ) : filteredLibrary.length === 0 ? (
            <div className="text-center py-16 sm:py-20 px-5 border border-neutral-900 rounded-2xl sm:rounded-3xl">
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-5 h-5"
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
              </div>

              <p className="text-sm text-neutral-400">
                No encontramos ese manga.
              </p>

              <button
                onClick={() => setSearch('')}
                className="text-xs text-pink-500 hover:text-pink-400 mt-2 cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4 md:gap-5">
              {filteredLibrary.map((manga) => {
                const data = progressData[manga.id];

                const isFinished =
                  data &&
                  data.totalChapters > 0 &&
                  data.progress >= 100;

                const isStarted =
                  data &&
                  data.progress > 0;

                return (
                  <Link
                    key={manga.id}
                    href={`/manga/${manga.id}`}
                    className="group min-w-0"
                  >
                    <div className="h-full flex flex-col overflow-hidden rounded-xl sm:rounded-2xl bg-neutral-900 border border-neutral-800/80 shadow-xl group-hover:border-pink-500/40 group-hover:-translate-y-1 transition-all duration-300">

                      {/* PORTADA */}

                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-950 shrink-0">
                        {manga.cover ? (
                          <img
                            src={manga.cover}
                            alt={manga.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-[1.045] transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500">
                            Sin portada
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        {/* ESTADO */}

                        {isFinished ? (
                          <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 flex items-center gap-1 bg-neutral-950/90 backdrop-blur-sm border border-green-500/20 text-green-400 px-1.5 sm:px-2 py-1 rounded-md sm:rounded-lg text-[8px] sm:text-[9px] font-bold">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m5 12 4 4L19 6"
                              />
                            </svg>

                            TERMINADO
                          </div>
                        ) : isStarted ? (
                          <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 bg-neutral-950/90 backdrop-blur-sm border border-pink-500/20 text-pink-400 px-1.5 sm:px-2 py-1 rounded-md sm:rounded-lg text-[8px] sm:text-[9px] font-bold">
                            EN PROGRESO
                          </div>
                        ) : null}

                        {/* ELIMINAR */}

                        <button
                          onClick={(e) =>
                            handleRemove(manga.id, e)
                          }
                          title="Eliminar de la biblioteca"
                          aria-label={`Eliminar ${manga.title}`}
                          className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-black/75 backdrop-blur-sm text-neutral-300 hover:text-white hover:bg-red-600 active:scale-95 transition-all cursor-pointer md:opacity-0 md:group-hover:opacity-100"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-3.5 h-3.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 6h18"
                            />

                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 6V4h8v2"
                            />

                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 6l-1 15H6L5 6"
                            />

                            <path
                              strokeLinecap="round"
                              d="M10 10v7M14 10v7"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* INFORMACIÓN */}

                      <div className="flex flex-col flex-1 p-2.5 sm:p-3.5">
                        <div className="min-h-9 sm:h-10">
                          <h3 className="font-bold text-[11px] sm:text-xs md:text-sm text-neutral-200 line-clamp-2 leading-4 sm:leading-5 group-hover:text-pink-400 transition-colors">
                            {manga.title}
                          </h3>
                        </div>

                        <div className="mt-auto pt-2.5 sm:pt-3">
                          {data &&
                          data.totalChapters > 0 ? (
                            <>
                              <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-neutral-500 mb-1.5">
                                <span>
                                  {data.readCount} /{' '}
                                  {data.totalChapters}
                                </span>

                                <span
                                  className={
                                    isFinished
                                      ? 'text-green-400 font-bold'
                                      : 'text-neutral-400 font-bold'
                                  }
                                >
                                  {data.progress}%
                                </span>
                              </div>

                              <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isFinished
                                      ? 'bg-green-500'
                                      : 'bg-pink-500'
                                  }`}
                                  style={{
                                    width: `${data.progress}%`,
                                  }}
                                />
                              </div>
                            </>
                          ) : (
                            <div className="h-[18px] flex items-end">
                              <span className="text-[9px] sm:text-[10px] text-neutral-500">
                                Sin empezar
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* MODAL */}

        {isModalOpen && (
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setIsModalOpen(false);
                setError('');
              }
            }}
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 md:p-7 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">

              {/* MODAL HEADER */}

              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.25em] text-pink-500 font-bold mb-1">
                    Biblioteca
                  </p>

                  <h3 className="text-xl font-black text-white">
                    Añadir manga
                  </h3>
                </div>

                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setError('');
                  }}
                  aria-label="Cerrar"
                  className="w-9 h-9 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      d="M6 6l12 12M18 6 6 18"
                    />
                  </svg>
                </button>
              </div>

              <form
                onSubmit={handleAddManga}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-2">
                    URL de WeebCentral
                  </label>

                  <input
                    type="text"
                    placeholder="https://weebcentral.com/series/..."
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setError('');
                    }}
                    className="w-full bg-neutral-950 px-4 py-3.5 rounded-xl border border-neutral-800 focus:outline-none focus:border-pink-500/60 text-sm text-white placeholder:text-neutral-600 transition-colors"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2.5">
                    <p className="text-red-400 text-xs">
                      {error}
                    </p>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setError('');
                    }}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl text-xs font-bold text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !urlInput.trim()
                    }
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 active:scale-[0.98] text-white font-bold px-5 py-3 rounded-xl text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-3.5 h-3.5 animate-spin"
                        >
                          <path
                            strokeLinecap="round"
                            d="M12 3v3M12 18v3M3 12h3M18 12h3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12"
                          />
                        </svg>

                        Procesando...
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="w-3.5 h-3.5"
                        >
                          <path
                            strokeLinecap="round"
                            d="M12 5v14M5 12h14"
                          />
                        </svg>

                        Añadir manga
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}