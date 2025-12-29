import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const runtime = 'nodejs';

function checkSecret(req: Request) {
  const secretEnv = process.env.DEV_DEBUG_SECRET;
  if (!secretEnv) return { ok: true };
  const header = req.headers.get('x-dev-secret') || '';
  return header === secretEnv ? { ok: true } : { ok: false, message: 'Missing or invalid DEV_DEBUG_SECRET' };
}

function sanitizeUsername(u: string): string | null {
  const trimmed = (u || '').trim();
  if (!trimmed) return null;
  return /^[A-Za-z0-9._]+$/.test(trimmed) ? trimmed : null;
}

function runYtDlp(username: string): Promise<{ urls: string[]; stderr: string }> {
  return new Promise((resolve, reject) => {
    const args = ['--flat-playlist', '--print', '%(url)s', `https://www.instagram.com/${username}/`];
    const proc = spawn('yt-dlp', args, { shell: false });
    let stdout = '';
    let stderr = '';

    const killTimer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('yt-dlp timed out (30s)'));
    }, 30_000);

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', err => {
      clearTimeout(killTimer);
      reject(err);
    });
    proc.on('close', code => {
      clearTimeout(killTimer);
      if (code === 0) {
        const urls = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        resolve({ urls, stderr: stderr.trim() });
      } else {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr || stdout}`));
      }
    });
  });
}

export async function GET(req: Request) {
  const secretEnv = !!process.env.DEV_DEBUG_SECRET;
  return NextResponse.json({ ok: true, message: 'POST username to fetch Instagram media URLs via yt-dlp', secretRequired: secretEnv });
}

export async function POST(req: Request) {
  const check = checkSecret(req);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.message }, { status: 401 });

  let username: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    username = body?.username || body?.user || body?.handle;
  } catch (e) {
    // ignore, handled below
  }
  if (!username) {
    const url = new URL(req.url);
    username = url.searchParams.get('username') || undefined;
  }

  const clean = username ? sanitizeUsername(username) : null;
  if (!clean) {
    return NextResponse.json({ ok: false, error: 'Provide username (letters, numbers, dot, underscore)' }, { status: 400 });
  }

  try {
    const { urls, stderr } = await runYtDlp(clean);
    return NextResponse.json({ ok: true, username: clean, count: urls.length, urls, stderr });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
