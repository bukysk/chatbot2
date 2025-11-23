import { NextResponse } from 'next/server';
import { reloadIndex } from '../../../../lib/pdfIndex';

export async function POST() {
  try {
    const count = reloadIndex();
    if (count === null) {
      return NextResponse.json({ ok: false, message: 'Index file not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, reloaded: true, chunks: count });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  // convenience: report whether index is loaded and its size
  try {
    const count = reloadIndex();
    if (count === null) return NextResponse.json({ ok: false, message: 'Index file not found' }, { status: 404 });
    return NextResponse.json({ ok: true, chunks: count });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
