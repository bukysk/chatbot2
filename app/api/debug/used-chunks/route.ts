import { NextResponse } from 'next/server';
import { retrieveSubjectContextDetailed } from '../../../../lib/pdfIndex';

export async function POST(req: Request) {
  // Accept JSON body { query: string, topK?: number }
  try {
    const body = await req.json();
    const query = body?.query;
    const topK = body?.topK ?? undefined;
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ ok: false, error: 'Missing query in request body' }, { status: 400 });
    }
    const details = await retrieveSubjectContextDetailed(query, topK);
    return NextResponse.json({ ok: true, query, topK: details.length, chunks: details });
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
    if (!q) return NextResponse.json({ ok: false, error: 'Missing q param' }, { status: 400 });
    const topK = top ? parseInt(top, 10) : undefined;
    const details = await retrieveSubjectContextDetailed(q, topK);
    return NextResponse.json({ ok: true, query: q, topK: details.length, chunks: details });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
