import { NextResponse } from 'next/server';
import { getInstagramScraperStatus, scrapeInstagramAccount, isInstagramScraperRunning } from '../../../../lib/instagramScraper';

function checkSecret(req: Request) {
  const secretEnv = process.env.DEV_DEBUG_SECRET;
  if (!secretEnv) return { ok: true };
  const header = req.headers.get('x-dev-secret') || '';
  return header === secretEnv ? { ok: true } : { ok: false, message: 'Missing or invalid DEV_DEBUG_SECRET' };
}

export async function GET(req: Request) {
  try {
    const check = checkSecret(req);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.message }, { status: 401 });

    const status = getInstagramScraperStatus();
    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const check = checkSecret(req);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.message }, { status: 401 });

    if (isInstagramScraperRunning()) {
      return NextResponse.json({ ok: false, error: 'Scraper is already running' }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const username = body?.username || body?.user || body?.handle;

    if (!username) {
      return NextResponse.json({ ok: false, error: 'Provide username in request body' }, { status: 400 });
    }

    // Start the scraping process (runs async but we don't wait)
    scrapeInstagramAccount(username)
      .then(status => {
        console.log('[instagram-scraper] Completed:', status);
      })
      .catch(err => {
        console.error('[instagram-scraper] Error:', err);
      });

    return NextResponse.json({ ok: true, message: 'Scraper started', username });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
