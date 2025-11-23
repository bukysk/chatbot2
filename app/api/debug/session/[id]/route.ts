import { NextResponse } from 'next/server';
import { getRetrievals } from '../../../../../lib/retrievalDebugStore';
import fs from 'fs';
import path from 'path';

const INDEX_FILE = path.join(process.cwd(), 'data', 'subject_chunks.json');

function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) return null;
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return null;
  }
}

export async function GET(req: Request, context: any) {
  try {
    const params = await context.params;
    const id = params?.id;
    if (!id) return NextResponse.json({ ok: false, error: 'Missing session id' }, { status: 400 });
    const recs = getRetrievals(id);
    if (!recs) return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });

    // support ?includeTexts=1 to resolve chunk texts from the index
    const url = new URL(req.url);
    const include = url.searchParams.get('includeTexts') || url.searchParams.get('include_texts');
    if (include) {
      const idx = loadIndex();
      const map: Record<string, any> = {};
      if (idx && Array.isArray(idx.chunks)) {
        for (const c of idx.chunks) map[c.id] = c;
      }
      const enriched = recs.map((r) => ({
        ...r,
        chunks: r.chunks.map((c: any) => ({ ...(map[c.id] ?? {}), score: c.score ?? (c as any).score }))
      }));
      return NextResponse.json({ ok: true, sessionId: id, count: enriched.length, records: enriched });
    }

    return NextResponse.json({ ok: true, sessionId: id, count: recs.length, records: recs });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
