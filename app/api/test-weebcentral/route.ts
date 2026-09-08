import { NextResponse } from 'next/server';

const TEST_URLS = [
  'https://weebcentral.com/',
  'https://weebcentral.com/series/01J76XYCJ1SSSQSAEKZXCMKMAD/Ijiranaide-Nagatoro-san',
  'https://weebcentral.com/chapters/01J76XYZW77APVWYRPG66WF9Q8',
];

async function testUrl(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language':
          'es-MX,es;q=0.9,en;q=0.8',
        'Referer':
          'https://weebcentral.com/',
      },
    });

    const body = await response.text();

    return {
      url,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      server: response.headers.get('server'),
      bodyStart: body.slice(0, 300),
    };
  } catch (error) {
    return {
      url,
      error: String(error),
    };
  }
}

export async function GET() {
  const results = [];

  for (const url of TEST_URLS) {
    results.push(await testUrl(url));
  }

  return NextResponse.json({
    results,
  });
}