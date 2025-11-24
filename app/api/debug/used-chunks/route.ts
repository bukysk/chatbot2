import { NextResponse } from 'next/server';
import { retrieveSubjectContextDetailed, retrieveRagChunks, retrieveHybridContext, retrieveCentroidChunks } from '../../../../lib/pdfIndex';

export async function POST(req: Request) {
  // Accept JSON body { query: string, topK?: number }
  try {
    const body = await req.json();
    const query = body?.query;
    const topK = body?.topK ?? undefined;
    const mode = (body?.mode || 'detailed');
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ ok: false, error: 'Missing query in request body' }, { status: 400 });
    }

    let details = [] as any[];
    if (mode === 'rag') {
      details = await retrieveRagChunks(query, topK ?? 5);
    } else if (mode === 'hybrid') {
      details = await retrieveHybridContext(query, topK ?? 10);
    } else if (mode === 'centroid') {
      details = await retrieveCentroidChunks(topK ?? 5);
    } else {
      details = await retrieveSubjectContextDetailed(query, topK);
    }

    return NextResponse.json({ ok: true, query, mode, topK: details.length, chunks: details });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Convenience: allow GET with query param ?q=...&top=3
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q');
    const top = url.searchParams.get('top');
    const mode = url.searchParams.get('mode') || 'detailed';
    if (!q) return NextResponse.json({ ok: false, error: 'Missing q param' }, { status: 400 });
    const topK = top ? parseInt(top, 10) : undefined;

    let details = [] as any[];
    if (mode === 'rag') {
      details = await retrieveRagChunks(q, topK ?? 5);
    } else if (mode === 'hybrid') {
      details = await retrieveHybridContext(q, topK ?? 10);
    } else if (mode === 'centroid') {
      details = await retrieveCentroidChunks(topK ?? 5);
    } else {
      details = await retrieveSubjectContextDetailed(q, topK);
    }

    return NextResponse.json({ ok: true, query: q, mode, topK: details.length, chunks: details });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
