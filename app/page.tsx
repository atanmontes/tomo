'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MangaItem {
  id: string;
  title: string;
  cover: string;
  url: string;
}

export default function Home() {
  const [urlInput, setUrlInput] = useState('');
  const [library, setLibrary] = useState<MangaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('my_manga_library');
    if (saved) {
      try {
        setLibrary(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleAddManga = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/manga?url=${encodeURIComponent(urlInput)}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'No se pudo agregar el manga');

      const match = urlInput.trim().match(/\/series\/([a-zA-Z0-9]+)/);
      if (!match) throw new Error('Link de serie inválido');
      const seriesId = match[1];

      if (library.some((item) => item.id === seriesId)) {
        throw new Error('Este manga ya está en tu biblioteca');
      }

      const newItem: MangaItem = {
        id: seriesId,
        title: data.manga.title,
        cover: data.manga.cover,
        url: urlInput.trim(),
      };

      const updatedLibrary = [newItem, ...library];
      setLibrary(updatedLibrary);
      localStorage.setItem('my_manga_library', JSON.stringify(updatedLibrary));
      setUrlInput('');
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const updated = library.filter((item) => item.id !== id);
    setLibrary(updated);
    localStorage.setItem('my_manga_library', JSON.stringify(updated));
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center border-b border-neutral-900 pb-4">
          <h1 className="text-3xl font-black tracking-wider text-white">
            TOM<span className="text-pink-500">O</span>
          </h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-4 py-2 rounded-xl transition-colors text-sm cursor-pointer shadow-lg shadow-pink-500/10 flex items-center gap-2"
          >
            <span>+</span> Añadir Manga
          </button>
        </header>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Agregar nuevo manga</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-neutral-400 hover:text-white text-sm px-2 py-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddManga} className="space-y-4">
                <input
                  type="text"
                  placeholder="Pega el link de la serie de WeebCentral..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full bg-neutral-950 px-4 py-3 rounded-xl border border-neutral-800 focus:outline-none focus:border-pink-500 text-sm"
                  autoFocus
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm text-neutral-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'Procesando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-neutral-300">Biblioteca</h2>

          {library.length === 0 ? (
            <div className="text-center py-20 text-neutral-600 border border-dashed border-neutral-900 rounded-3xl space-y-2">
              <p className="text-sm">Tu biblioteca está vacía.</p>
              <p className="text-xs text-neutral-600">Haz clic en &quot;Añadir Manga&quot; arriba a la derecha para empezar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {library.map((manga) => (
                <Link
                  key={manga.id}
                  href={`/manga/${manga.id}`}
                  className="group bg-neutral-900 border border-neutral-800/80 rounded-2xl overflow-hidden shadow-lg hover:border-pink-500/50 transition-all flex flex-col"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-950">
                    {manga.cover ? (
                      <img
                        src={manga.cover}
                        alt={manga.title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-neutral-600">
                        Sin portada
                      </div>
                    )}
                    <button
                      onClick={(e) => handleRemove(manga.id, e)}
                      title="Eliminar de la biblioteca"
                      className="absolute top-2 right-2 bg-neutral-950/80 hover:bg-red-600 text-white p-1.5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <h3 className="font-medium text-xs text-neutral-200 line-clamp-2 group-hover:text-pink-400 transition-colors">
                      {manga.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}