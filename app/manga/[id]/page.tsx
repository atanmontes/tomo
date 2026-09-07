'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function MangaDetail() {
  const params = useParams();
  const id = params.id as string;

  const [mangaData, setMangaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    const fetchMangaDetails = async () => {
      try {
        const targetUrl = `https://weebcentral.com/series/${id}`;
        const res = await fetch(`/api/manga?url=${encodeURIComponent(targetUrl)}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error al cargar el manga');

        setMangaData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMangaDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <p className="text-pink-500 font-medium animate-pulse">Cargando TOMO...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <Link href="/" className="bg-pink-500 text-white font-bold px-4 py-2 rounded-lg text-sm">
          Volver a la Biblioteca
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-sm text-pink-400 hover:underline">
            ← Volver a la Biblioteca
          </Link>
          <span className="text-2xl font-black tracking-wider text-white">
            TOM<span className="text-pink-500">O</span>
          </span>
        </div>

        {mangaData && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-6 bg-neutral-900/50 p-6 rounded-2xl border border-neutral-800 backdrop-blur">
              {mangaData.manga.cover && (
                <img
                  src={mangaData.manga.cover}
                  alt={mangaData.manga.title}
                  className="w-48 h-72 object-cover rounded-xl shadow-md mx-auto md:mx-0 border border-neutral-700"
                />
              )}
              <div className="space-y-3 flex-1 text-center md:text-left">
                <h1 className="text-2xl md:text-3xl font-bold text-white">{mangaData.manga.title}</h1>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  {mangaData.manga.synopsis}
                </p>
                <div className="inline-block bg-neutral-800 px-4 py-1.5 rounded-full text-xs font-semibold text-pink-400 border border-neutral-700">
                  {mangaData.chapters.length} Capítulos disponibles
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-bold border-b border-neutral-800 pb-2">Capítulos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
                {mangaData.chapters.map((ch: any, idx: number) => (
                  <a
                    key={idx}
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex justify-between items-center bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 p-4 rounded-xl transition-all group"
                  >
                    <span className="font-medium text-sm text-neutral-200 group-hover:text-pink-400 transition-colors">
                      {ch.title}
                    </span>
                    <span className="text-xs text-neutral-500 bg-neutral-950 px-2.5 py-1 rounded-md border border-neutral-800 group-hover:border-pink-500/50">
                      Leer ➔
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}