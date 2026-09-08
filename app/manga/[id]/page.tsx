'use client';

import {
useEffect,
useRef,
useState,
} from 'react';

import {
useParams,
useSearchParams,
} from 'next/navigation';

import Link from 'next/link';

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

type ReaderMode = 'vertical' | 'page';

export default function MangaDetail() {
const params = useParams();
const searchParams = useSearchParams();

const id = params.id as string;
const chapterFromUrl = searchParams.get('chapter');

const autoOpenedChapter = useRef(false);

const [mangaData, setMangaData] =
useState<MangaData | null>(null);

const [loading, setLoading] =
useState(true);

const [error, setError] =
useState('');

const [searchFilter, setSearchFilter] =
useState('');

const [sortOrder, setSortOrder] =
useState<'asc' | 'desc'>('asc');

/* ============================================================
LECTOR
============================================================ */

const [activeChapter, setActiveChapter] =
useState<Chapter | null>(null);

const [chapterImages, setChapterImages] =
useState<string[]>([]);

const [readerLoading, setReaderLoading] =
useState(false);

const [readerError, setReaderError] =
useState('');

const [readerMode, setReaderMode] =
useState<ReaderMode>('page');

const [currentPage, setCurrentPage] =
useState(0);

const [showChapterList, setShowChapterList] =
useState(false);

const [chapterSearch, setChapterSearch] =
useState('');

/* ============================================================
PROGRESO
============================================================ */

const [readChapters, setReadChapters] =
useState<string[]>([]);

const [savedPages, setSavedPages] =
useState<Record<string, number>>({});

/* ============================================================
CONTROL DE SCROLL VERTICAL
============================================================ */

const [hasUserScrolled, setHasUserScrolled] =
useState(false);

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

  const savedPagesData =
    localStorage.getItem(
      `tomo_pages_${id}`
    );

  if (savedRead) {
    const parsedRead =
      JSON.parse(savedRead);

    if (Array.isArray(parsedRead)) {
      setReadChapters(parsedRead);
    }
  }

  if (savedPagesData) {
    const parsedPages =
      JSON.parse(savedPagesData);

    if (
      parsedPages &&
      typeof parsedPages === 'object'
    ) {
      setSavedPages(parsedPages);
    }
  }
} catch (error) {
  console.error(
    'No se pudo cargar el progreso:',
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
          'Error al cargar el manga'
      );
    }

    /*
     * La API nueva devuelve directamente:
     *
     * {
     *   title,
     *   cover,
     *   synopsis,
     *   totalChapters,
     *   chapters
     * }
     */

    setMangaData({
      title: data.title || 'Sin título',
      cover: data.cover || '',
      synopsis: data.synopsis || '',
      totalChapters:
        data.totalChapters ??
        data.chapters?.length ??
        0,
      chapters: Array.isArray(
        data.chapters
      )
        ? data.chapters
        : [],
    });
  } catch (err: any) {
    setError(
      err.message ||
        'Error al cargar el manga'
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
previous.includes(chapterId);


  const updated = alreadyRead
    ? previous.filter(
        (chapter) =>
          chapter !== chapterId
      )
    : [...previous, chapterId];

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
if (previous.includes(chapterId)) {
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
GUARDAR PÁGINA
============================================================ */

const savePageProgress = (
chapterId: string,
page: number
) => {
setSavedPages((previous) => {
const updated = {
...previous,
[chapterId]: page,
};


  localStorage.setItem(
    `tomo_pages_${id}`,
    JSON.stringify(updated)
  );

  return updated;
});


};

/* ============================================================
CAPÍTULOS ORDENADOS NUMÉRICAMENTE
============================================================ */

const orderedChapters =
mangaData?.chapters
? [...mangaData.chapters].sort(
(a, b) => {
const numA =
parseFloat(
a.title.replace(
/[^\d.]/g,
''
)
) || 0;


        const numB =
          parseFloat(
            b.title.replace(
              /[^\d.]/g,
              ''
            )
          ) || 0;

        return numA - numB;
      }
    )
  : [];


/* ============================================================
ABRIR CAPÍTULO
============================================================ */

const openBuiltInReader = async (
chapter: Chapter
) => {
/*
* Guardamos explícitamente el último
* capítulo que el usuario abrió.
*/
localStorage.setItem(
`tomo_last_chapter_${id}`,
chapter.id
);


setActiveChapter(chapter);
setChapterImages([]);
setReaderError('');
setReaderLoading(true);
setShowChapterList(false);
setHasUserScrolled(false);

/*
 * Intentamos usar el progreso que ya
 * tenemos en memoria.
 *
 * Si todavía no se cargó desde localStorage,
 * usamos directamente localStorage como respaldo.
 */
let savedPage =
  savedPages[chapter.id];

if (savedPage === undefined) {
  try {
    const storedPages =
      localStorage.getItem(
        `tomo_pages_${id}`
      );

    if (storedPages) {
      const parsed =
        JSON.parse(storedPages);

      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed[chapter.id] ===
          'number'
      ) {
        savedPage =
          parsed[chapter.id];
      }
    }
  } catch {
    // Ignorar errores de progreso
  }
}

if (savedPage === undefined) {
  savedPage = 0;
}

setCurrentPage(savedPage);

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
        'No se pudieron cargar las páginas'
    );
  }

  const images =
    Array.isArray(data.images)
      ? data.images
      : [];

  if (images.length === 0) {
    throw new Error(
      'WeebCentral no devolvió ninguna página.'
    );
  }

  setChapterImages(images);

  if (
    savedPage >= images.length
  ) {
    setCurrentPage(0);

    savePageProgress(
      chapter.id,
      0
    );
  }

  requestAnimationFrame(() => {
    const container =
      document.getElementById(
        'tomo-reader-content'
      );

    if (container) {
      container.scrollTop = 0;
    }
  });
} catch (err: any) {
  setReaderError(
    err.message ||
      'No se pudo cargar el capítulo'
  );
} finally {
  setReaderLoading(false);
}


};

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
      item.id === chapterFromUrl
  );

if (!chapter) return;

autoOpenedChapter.current = true;

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
      chapter.id === activeChapter.id
  );

if (
  currentIndex === -1 ||
  currentIndex >=
    orderedChapters.length - 1
) {
  return;
}

const next =
  orderedChapters[currentIndex + 1];

markChapterAsRead(
  activeChapter.id
);

openBuiltInReader(next);


};

/* ============================================================
SIGUIENTE PÁGINA
============================================================ */

const nextPage = () => {
if (
!chapterImages.length ||
!activeChapter
) {
return;
}


const next =
  currentPage + 1;

if (
  next >= chapterImages.length
) {
  markChapterAsRead(
    activeChapter.id
  );

  return;
}

setCurrentPage(next);

savePageProgress(
  activeChapter.id,
  next
);

if (
  next ===
  chapterImages.length - 1
) {
  markChapterAsRead(
    activeChapter.id
  );
}


};

/* ============================================================
PÁGINA ANTERIOR
============================================================ */

const previousPage = () => {
if (
!activeChapter ||
currentPage <= 0
) {
return;
}


const previous =
  currentPage - 1;

setCurrentPage(previous);

savePageProgress(
  activeChapter.id,
  previous
);


};

/* ============================================================
DETECTAR FINAL EN MODO VERTICAL
============================================================ */

useEffect(() => {
if (!activeChapter) return;
if (readerMode !== 'vertical') return;
if (chapterImages.length === 0) return;


const container =
  document.getElementById(
    'tomo-reader-content'
  );

if (!container) return;

const handleScroll = () => {
  if (container.scrollTop > 10) {
    setHasUserScrolled(true);
  }

  if (!hasUserScrolled) {
    return;
  }

  const distanceFromBottom =
    container.scrollHeight -
    container.scrollTop -
    container.clientHeight;

  if (
    distanceFromBottom <= 150 &&
    !readChapters.includes(
      activeChapter.id
    )
  ) {
    markChapterAsRead(
      activeChapter.id
    );
  }
};

container.addEventListener(
  'scroll',
  handleScroll
);

return () => {
  container.removeEventListener(
    'scroll',
    handleScroll
  );
};


}, [
activeChapter,
readerMode,
chapterImages.length,
readChapters,
hasUserScrolled,
]);

/* ============================================================
TECLADO
============================================================ */

useEffect(() => {
if (!activeChapter) return;
if (readerMode !== 'page') return;


const handleKeyDown = (
  event: KeyboardEvent
) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    nextPage();
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    previousPage();
  }

  if (event.key === 'Escape') {
    closeReader();
  }
};

window.addEventListener(
  'keydown',
  handleKeyDown
);

return () => {
  window.removeEventListener(
    'keydown',
    handleKeyDown
  );
};


}, [
activeChapter,
readerMode,
currentPage,
chapterImages.length,
]);

/* ============================================================
CERRAR LECTOR
============================================================ */

const closeReader = () => {
if (
activeChapter &&
chapterImages.length > 0
) {
savePageProgress(
activeChapter.id,
currentPage
);
}


setActiveChapter(null);
setChapterImages([]);
setReaderError('');
setShowChapterList(false);
setHasUserScrolled(false);


};

/* ============================================================
ORDEN / FILTRO
============================================================ */

const filteredChapters =
mangaData?.chapters
? [...mangaData.chapters]
.filter((chapter) =>
chapter.title
.toLowerCase()
.includes(
searchFilter.toLowerCase()
)
)
.sort((a, b) => {
const numA =
parseFloat(
a.title.replace(
/[^\d.]/g,
''
)
) || 0;


        const numB =
          parseFloat(
            b.title.replace(
              /[^\d.]/g,
              ''
            )
          ) || 0;

        return sortOrder === 'asc'
          ? numA - numB
          : numB - numA;
      })
  : [];


/* ============================================================
CAPÍTULOS DEL DRAWER
============================================================ */

const readerChapters =
orderedChapters.filter(
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
return ( <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center"> <p className="text-pink-500 font-medium animate-pulse">
Cargando TOMO... </p> </div>
);
}

/* ============================================================
ERROR
============================================================ */

if (error) {
return ( <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4"> <p className="text-red-400">
{error} </p>


    <Link
      href="/"
      className="bg-pink-500 text-white font-bold px-4 py-2 rounded-lg text-sm"
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
return ( <div className="fixed inset-0 bg-neutral-950 text-neutral-100 z-50 flex flex-col">


    {/* HEADER */}

    <header className="bg-neutral-900 border-b border-neutral-800 px-3 md:px-6 py-3 flex items-center justify-between gap-3 shrink-0">

      <div className="min-w-0 flex items-center gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold truncate text-white">
            {activeChapter.title}
          </h2>

          <p className="text-[10px] text-neutral-500 hidden sm:block">
            {activeChapterIndex + 1} de{' '}
            {orderedChapters.length}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">

        {/* CAPÍTULOS */}

        <button
          onClick={() =>
            setShowChapterList(
              !showChapterList
            )
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
            showChapterList
              ? 'bg-pink-500 text-white border-pink-500'
              : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white hover:bg-neutral-700'
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

        {/* CAMBIO DE MODO */}

        <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">

          <button
            onClick={() =>
              setReaderMode(
                'vertical'
              )
            }
            className={`px-2.5 md:px-3 py-1.5 rounded-md text-xs font-medium ${
              readerMode === 'vertical'
                ? 'bg-pink-500 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Vertical
          </button>

          <button
            onClick={() =>
              setReaderMode('page')
            }
            className={`px-2.5 md:px-3 py-1.5 rounded-md text-xs font-medium ${
              readerMode === 'page'
                ? 'bg-pink-500 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Hoja
          </button>

        </div>

        {/* LEÍDO */}

        <button
          onClick={() =>
            toggleChapterRead(
              activeChapter.id
            )
          }
          className={`hidden sm:block px-3 py-1.5 rounded-lg text-xs font-bold border ${
            readChapters.includes(
              activeChapter.id
            )
              ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
              : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
          }`}
          title={
            readChapters.includes(
              activeChapter.id
            )
              ? 'Desmarcar como leído'
              : 'Marcar como leído'
          }
        >
          {readChapters.includes(
            activeChapter.id
          )
            ? '✓ Leído'
            : 'Marcar leído'}
        </button>

        {/* CERRAR */}

        <button
          onClick={closeReader}
          className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
        >
          <span className="hidden sm:inline">
            Cerrar
          </span>{' '}
          ✕
        </button>

      </div>
    </header>

    {/* DRAWER */}

    {showChapterList && (
      <div className="absolute inset-0 z-40">

        <button
          onClick={() =>
            setShowChapterList(false)
          }
          className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
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
                  {orderedChapters.length}{' '}
                  capítulos
                </p>
              </div>

              <button
                onClick={() =>
                  setShowChapterList(
                    false
                  )
                }
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>

            </div>

            <input
              type="text"
              placeholder="Buscar capítulo..."
              value={chapterSearch}
              onChange={(e) =>
                setChapterSearch(
                  e.target.value
                )
              }
              className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-xl text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-pink-500"
            />

          </div>

          <div className="flex-1 overflow-y-auto p-3">

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
                        key={chapter.id}
                        onClick={() =>
                          openBuiltInReader(
                            chapter
                          )
                        }
                        className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                          isActive
                            ? 'bg-pink-500/10 border-pink-500/40'
                            : isRead
                            ? 'bg-green-500/[0.03] border-green-500/10 hover:border-green-500/30'
                            : 'bg-neutral-900 border-neutral-800 hover:border-pink-500/30 hover:bg-neutral-900/80'
                        }`}
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-semibold truncate ${
                              isActive
                                ? 'text-pink-400'
                                : 'text-neutral-200'
                            }`}
                          >
                            {chapter.title}
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

    {/* CONTENIDO */}

    <div
      id="tomo-reader-content"
      className="flex-1 overflow-auto bg-black"
    >

      {/* CARGANDO */}

      {readerLoading && (
        <div className="min-h-full flex items-center justify-center">
          <p className="text-pink-500 font-medium animate-pulse">
            Cargando páginas...
          </p>
        </div>
      )}

      {/* ERROR */}

      {readerError && (
        <div className="min-h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-red-400 text-sm">
            {readerError}
          </p>

          <button
            onClick={() =>
              openBuiltInReader(
                activeChapter
              )
            }
            className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* VERTICAL */}

      {!readerLoading &&
        !readerError &&
        chapterImages.length > 0 &&
        readerMode === 'vertical' && (
          <div className="flex flex-col items-center">

            {chapterImages.map(
              (image, index) => (
                <img
                  key={`${activeChapter.id}-${index}`}
                  src={image}
                  alt={`Página ${
                    index + 1
                  }`}
                  loading={
                    index < 3
                      ? 'eager'
                      : 'lazy'
                  }
                  className="block max-w-full h-auto"
                />
              )
            )}

            <div className="w-full flex flex-col items-center py-12 px-4">

              <div className="w-12 h-px bg-neutral-800 mb-6" />

              <p className="text-xs text-neutral-500 mb-4">
                Fin del capítulo
              </p>

              {hasNextChapter ? (
                <button
                  onClick={
                    nextChapter
                  }
                  className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors"
                >
                  Siguiente capítulo →
                </button>
              ) : (
                <p className="text-xs text-neutral-600">
                  Has llegado al último
                  capítulo.
                </p>
              )}

            </div>
          </div>
        )}

      {/* HOJA */}

      {!readerLoading &&
        !readerError &&
        chapterImages.length > 0 &&
        readerMode === 'page' && (
          <div className="min-h-full flex flex-col items-center justify-center px-1 py-2 md:px-6 md:py-6">

            <div className="w-full flex justify-center">
              <img
                src={
                  chapterImages[
                    currentPage
                  ]
                }
                alt={`Página ${
                  currentPage + 1
                }`}
                className="w-full max-w-5xl max-h-[calc(100vh-125px)] md:max-h-[calc(100vh-160px)] object-contain"
              />
            </div>

            <div className="w-[90%] max-w-md h-1 bg-neutral-900 rounded-full mt-7 overflow-hidden">
              <div
                className="h-full bg-pink-500 transition-all"
                style={{
                  width: `${
                    ((currentPage + 1) /
                      chapterImages.length) *
                    100
                  }%`,
                }}
              />
            </div>

            {currentPage ===
              chapterImages.length - 1 && (
              <button
                onClick={() =>
                  toggleChapterRead(
                    activeChapter.id
                  )
                }
                className={`mt-5 px-4 py-2 rounded-lg text-xs font-bold ${
                  readChapters.includes(
                    activeChapter.id
                  )
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {readChapters.includes(
                  activeChapter.id
                )
                  ? '✓ Leído'
                  : '✓ Marcar capítulo como leído'}
              </button>
            )}

          </div>
        )}

    </div>

    {/* CONTROLES HOJA */}

    {readerMode === 'page' && (
      <footer className="bg-neutral-900 border-t border-neutral-800 px-3 py-2.5 shrink-0">

        <div className="flex items-center justify-center gap-3 max-w-5xl mx-auto">

          <button
            onClick={previousPage}
            disabled={currentPage === 0}
            className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
          >
            ← Anterior
          </button>

          <span className="text-xs text-neutral-400 min-w-[65px] text-center">
            {currentPage + 1} /{' '}
            {chapterImages.length}
          </span>

          <button
            onClick={nextPage}
            disabled={
              currentPage >=
              chapterImages.length - 1
            }
            className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
          >
            Siguiente →
          </button>

        </div>

        {currentPage ===
          chapterImages.length - 1 &&
          hasNextChapter && (
            <div className="flex justify-center mt-3">

              <button
                onClick={nextChapter}
                className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors"
              >
                Siguiente capítulo →
              </button>

            </div>
          )}

      </footer>
    )}

  </div>
);


}

/* ============================================================
PÁGINA DEL MANGA
============================================================ */

return ( <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12 relative">


  <div className="max-w-4xl mx-auto space-y-8">

    {/* HEADER */}

    <div className="flex justify-between items-center">

      <Link
        href="/"
        className="text-sm text-pink-400 hover:underline"
      >
        ← Volver a la Biblioteca
      </Link>

      <span className="text-2xl font-black tracking-wider text-white">
        TOM
        <span className="text-pink-500">
          O
        </span>
      </span>

    </div>

    {mangaData && (
      <div className="space-y-8">

        {/* INFORMACIÓN */}

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
              {mangaData.synopsis}
            </p>

            <div className="flex flex-wrap gap-2 justify-center md:justify-start">

              <div className="inline-block bg-neutral-800 px-4 py-1.5 rounded-full text-xs font-semibold text-pink-400 border border-neutral-700">
                {mangaData.chapters.length}{' '}
                Capítulos totales
              </div>

              <div className="inline-block bg-neutral-800 px-4 py-1.5 rounded-full text-xs font-semibold text-green-400 border border-neutral-700">
                {readChapters.length}{' '}
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

        {/* CAPÍTULOS */}

        <div className="space-y-4">

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-neutral-800 pb-4">

            <h3 className="text-xl font-bold">
              Capítulos
            </h3>

            <div className="flex items-center gap-2 w-full sm:w-auto">

              <input
                type="text"
                placeholder="Buscar capítulo..."
                value={searchFilter}
                onChange={(e) =>
                  setSearchFilter(
                    e.target.value
                  )
                }
                className="bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500 w-full sm:w-48"
              />

              <button
                onClick={() =>
                  setSortOrder(
                    sortOrder ===
                      'asc'
                      ? 'desc'
                      : 'asc'
                  )
                }
                className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-300 transition-colors cursor-pointer shrink-0"
              >
                {sortOrder === 'asc'
                  ? 'Asc 📈'
                  : 'Desc 📉'}
              </button>

            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">

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

                  return (
                    <div
                      key={chapter.id}
                      className={`flex justify-between items-center bg-neutral-900 border p-4 rounded-xl transition-all group ${
                        isRead
                          ? 'border-green-500/20'
                          : 'border-neutral-800 hover:border-pink-500/50'
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

                        {chapter.title}
                      </button>

                      <div className="flex items-center gap-2 shrink-0">

                        <button
                          onClick={() =>
                            openBuiltInReader(
                              chapter
                            )
                          }
                          className="text-xs text-neutral-300 bg-neutral-950 px-3 py-1.5 rounded-md border border-neutral-800 group-hover:border-pink-500/50 hover:text-pink-400 shrink-0"
                        >
                          Leer →
                        </button>

                        <button
                          onClick={() =>
                            toggleChapterRead(
                              chapter.id
                            )
                          }
                          className={`text-xs px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                            isRead
                              ? 'text-green-400 border-green-500/30 bg-green-500/10 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10'
                              : 'text-neutral-400 border-neutral-800 bg-neutral-950 hover:text-pink-400 hover:border-pink-500/40'
                          }`}
                          title={
                            isRead
                              ? 'Desmarcar como leído'
                              : 'Marcar como leído'
                          }
                        >
                          {isRead
                            ? '✓ Leído'
                            : 'Marcar'}
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
