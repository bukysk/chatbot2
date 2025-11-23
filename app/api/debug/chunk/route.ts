import { NextResponse } from 'next/server';
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.id;
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id in body' }, { status: 400 });
    const idx = loadIndex();
    if (!idx || !Array.isArray(idx.chunks)) return NextResponse.json({ ok: false, error: 'Index not found' }, { status: 500 });
    const rec = idx.chunks.find((c: any) => c.id === id);
    if (!rec) return NextResponse.json({ ok: false, error: 'Chunk not found' }, { status: 404 });
    return NextResponse.json({ ok: true, chunk: rec });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id query param' }, { status: 400 });
    const idx = loadIndex();
    if (!idx || !Array.isArray(idx.chunks)) return NextResponse.json({ ok: false, error: 'Index not found' }, { status: 500 });
    const rec = idx.chunks.find((c: any) => c.id === id);
    if (!rec) return NextResponse.json({ ok: false, error: 'Chunk not found' }, { status: 404 });
    return NextResponse.json({ ok: true, chunk: rec });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
