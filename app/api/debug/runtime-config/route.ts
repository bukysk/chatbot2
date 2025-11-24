import { NextResponse } from 'next/server';
import runtimeConfig from '../../../../lib/runtimeConfig';

function checkSecret(req: Request) {
  const secretEnv = process.env.DEV_DEBUG_SECRET;
  if (!secretEnv) return { ok: true };
  const header = (req.headers.get('x-dev-secret') || '');
  return header === secretEnv ? { ok: true } : { ok: false, message: 'Missing or invalid DEV_DEBUG_SECRET' };
}

export async function GET() {
  try {
    const overrides = runtimeConfig.getOverrides();
    const effective = runtimeConfig.getEffectiveConfig();
    return NextResponse.json({ ok: true, overrides, effective });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const check = checkSecret(req);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.message }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    // Accept a flat map of string keys -> values
    const saved = runtimeConfig.setOverrides(body || {});
    const effective = runtimeConfig.getEffectiveConfig();
    return NextResponse.json({ ok: true, overrides: saved, effective });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
