'use client';

import { useState } from 'react';

export default function TestWeebPage() {
  const [result, setResult] = useState<string>('Esperando prueba...');

  async function testWeebCentral() {
    setResult('Probando...');

    const url =
      'https://weebcentral.com/chapters/01J76XYZW77APVWYRPG66WF9Q8/images?is_prev=False&current_page=1&reading_style=long_strip';

    try {
      const response = await fetch(url);

      const text = await response.text();

      setResult(
        JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
            responseStart: text.slice(0, 500),
          },
          null,
          2
        )
      );
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            error: String(error),
          },
          null,
          2
        )
      );
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          Prueba WeebCentral
        </h1>

        <button
          onClick={testWeebCentral}
          className="px-4 py-2 rounded-lg bg-white text-black hover:bg-neutral-200"
        >
          Probar conexión
        </button>

        <pre className="mt-6 whitespace-pre-wrap break-words rounded-lg bg-neutral-900 border border-neutral-800 p-4 text-sm">
          {result}
        </pre>
      </div>
    </main>
  );
}