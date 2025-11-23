import { NextResponse } from 'next/server';
import { listSessions } from '../../../../lib/retrievalDebugStore';

export async function GET() {
  try {
    const sessions = listSessions();
    return NextResponse.json({ ok: true, sessions });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
