import { NextResponse } from 'next/server';
import { getGymWatcherStatus, startGymWatcher, stopGymWatcher } from '@/lib/gymWatcherManager';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = getGymWatcherStatus();
    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const action = String(body?.action || 'start');
    if (action === 'start') {
      const status = await startGymWatcher();
      return NextResponse.json({ ok: true, status });
    }
    if (action === 'stop') {
      const status = stopGymWatcher();
      return NextResponse.json({ ok: true, status });
    }
    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
