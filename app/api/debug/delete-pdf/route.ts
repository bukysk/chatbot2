import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');

function checkSecret(req: Request) {
  const secretEnv = process.env.DEV_DEBUG_SECRET;
  if (!secretEnv) return { ok: true };
  const header = (req.headers.get('x-dev-secret') || '');
  return header === secretEnv ? { ok: true } : { ok: false, message: 'Missing or invalid DEV_DEBUG_SECRET' };
}

export async function POST(req: Request) {
  try {
    const check = checkSecret(req);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.message }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const name = body?.name;
    if (!name) return NextResponse.json({ ok: false, error: 'Missing name' }, { status: 400 });
    const safe = path.basename(String(name));
    const dest = path.join(PDF_DIR, safe);
    if (!fs.existsSync(dest)) return NextResponse.json({ ok: false, error: 'File not found' }, { status: 404 });
    try {
      fs.unlinkSync(dest);
      return NextResponse.json({ ok: true, name: safe, message: 'Deleted. Re-run rebuild-index to update embeddings.' });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
