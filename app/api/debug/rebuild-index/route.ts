import { NextResponse } from 'next/server';
import { reloadIndex } from '../../../../lib/pdfIndex';
import { execFileSync } from 'child_process';
import path from 'path';

const INDEXER_SCRIPT = path.join(process.cwd(), 'scripts', 'index-pdfs.ts');

function checkSecret(req: Request) {
  const secretEnv = process.env.DEV_DEBUG_SECRET;
  if (!secretEnv) return { ok: true };
  // prefer header 'x-dev-secret', fallback to body 'secret'
  const header = (req.headers.get('x-dev-secret') || '');
  return header === secretEnv ? { ok: true } : { ok: false, message: 'Missing or invalid DEV_DEBUG_SECRET' };
}

export async function GET(req: Request) {
  // explain how to trigger a rebuild
  try {
    const secretEnv = !!process.env.DEV_DEBUG_SECRET;
    return NextResponse.json({ ok: true, message: 'POST to this endpoint to rebuild the index. Guarded by DEV_DEBUG_SECRET when set.', secretRequired: secretEnv });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const check = checkSecret(req);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.message }, { status: 401 });

    if (!INDEXER_SCRIPT || !require('fs').existsSync(INDEXER_SCRIPT)) {
      return NextResponse.json({ ok: false, error: 'Indexer script not found: scripts/index-pdfs.ts' }, { status: 500 });
    }

    // Run the TypeScript indexer via node+ts-node/register so we don't require a compiled build.
    // This is intentionally synchronous for simplicity in dev; the call may take time and requires network (OpenAI) access.
    const node = process.execPath || 'node';
    // Use -r ts-node/register to run the TS script the same way as the developer would locally.
    const args = ['-r', 'ts-node/register', INDEXER_SCRIPT];

    let stdout = '';
    let stderr = '';
    try {
      stdout = execFileSync(node, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: any) {
      stderr = e.stderr?.toString?.() || String(e.message || e);
      // still attempt to reload index if file exists
    }

    // Try to reload the in-memory index after script runs (or even if it failed but file exists)
    const count = reloadIndex();
    return NextResponse.json({ ok: true, rebuildRan: true, stdout: stdout.slice(0, 20000), stderr: stderr.slice(0, 20000), chunks: count });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
