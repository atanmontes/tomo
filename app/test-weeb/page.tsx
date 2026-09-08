'use client';

import { useState } from 'react';

const chapterUrl =
  'https://weebcentral.com/chapters/01J76XYZW77APVWYRPG66WF9Q8/images?is_prev=False&current_page=1&reading_style=long_strip';

export default function TestWeebPage() {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <main className="min-h-screen bg-black text-white">
      {!fullscreen && (
        <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-zinc-800 bg-black/95 backdrop-blur">
          <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
            <div>
              <h1 className="font-bold text-lg">TOMO</h1>
              <p className="text-xs text-zinc-500">
                Ijiranaide, Nagatoro-san · Capítulo 1
              </p>
            </div>

            <button
              onClick={() => setFullscreen(true)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              Pantalla completa
            </button>
          </div>
        </header>
      )}

      <div
        className={
          fullscreen
            ? 'fixed inset-0 z-40 bg-black'
            : 'pt-16'
        }
      >
        <iframe
          src={chapterUrl}
          title="Ijiranaide, Nagatoro-san — Capítulo 1"
          className="block h-[calc(100vh-4rem)] w-full border-0"
          referrerPolicy="origin"
        />
      </div>

      {fullscreen && (
        <button
          onClick={() => setFullscreen(false)}
          className="fixed bottom-5 right-5 z-50 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black shadow-lg"
        >
          Salir
        </button>
      )}
    </main>
  );
}