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
    let content = body?.content;
    if (!name || !content) return NextResponse.json({ ok: false, error: 'Missing name or content' }, { status: 400 });
    if (!name.toLowerCase().endsWith('.pdf')) return NextResponse.json({ ok: false, error: 'Only .pdf files allowed' }, { status: 400 });

    // strip data: prefix if present
    content = String(content).replace(/^data:.*;base64,/, '');
    const buf = Buffer.from(content, 'base64');
    const MAX = 50 * 1024 * 1024; // 50MB
    if (buf.length > MAX) return NextResponse.json({ ok: false, error: 'File too large' }, { status: 413 });

    fs.mkdirSync(PDF_DIR, { recursive: true });
    const safeName = path.basename(name);
    const dest = path.join(PDF_DIR, safeName);
    fs.writeFileSync(dest, buf);
    return NextResponse.json({ ok: true, name: safeName, size: buf.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
