import { NextResponse } from 'next/server';
import { reloadIndex } from '../../../../lib/pdfIndex';
import runIndexer from '../../../../lib/indexer';

function checkSecret(req: Request) {
  const secretEnv = process.env.DEV_DEBUG_SECRET;
  if (!secretEnv) return { ok: true };
  // prefer header 'x-dev-secret', fallback to body 'secret'
  const header = (req.headers.get('x-dev-secret') || '');
  return header === secretEnv ? { ok: true } : { ok: false, message: 'Missing or invalid DEV_DEBUG_SECRET' };
}

export async function GET(req: Request) {
  // explain how to trigger a rebuild
  try {
    const secretEnv = !!process.env.DEV_DEBUG_SECRET;
    return NextResponse.json({ ok: true, message: 'POST to this endpoint to rebuild the index. Guarded by DEV_DEBUG_SECRET when set.', secretRequired: secretEnv });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const check = checkSecret(req);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.message }, { status: 401 });
    // Call the indexer library directly (runs in-process and uses OPENAI_API_KEY)
    try {
      const res = await runIndexer();
      // reload in-memory index
      const count = reloadIndex();
      return NextResponse.json({ ok: true, rebuildRan: true, chunksWritten: res.chunks, outFile: res.outFile, chunksLoaded: count });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
