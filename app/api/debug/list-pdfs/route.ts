import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');

export async function GET() {
  try {
    if (!fs.existsSync(PDF_DIR)) return NextResponse.json({ ok: true, files: [] });
    const names = fs.readdirSync(PDF_DIR);
    const files = names.map(name => {
      try {
        const stat = fs.statSync(path.join(PDF_DIR, name));
        return { name, size: stat.size, mtime: stat.mtime.toISOString() };
      } catch (e) {
        return { name, size: null, mtime: null };
      }
    });
    return NextResponse.json({ ok: true, files });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
