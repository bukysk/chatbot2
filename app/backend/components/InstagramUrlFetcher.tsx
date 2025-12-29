"use client";

import React, { useState } from 'react';

interface FetchResult {
  username: string;
  urls: string[];
  count: number;
  stderr?: string;
}

export default function InstagramUrlFetcher() {
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FetchResult | null>(null);

  async function runFetch() {
    const handle = username.trim();
    if (!handle) return alert('Enter Instagram username');
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secret.trim()) headers['x-dev-secret'] = secret.trim();
      const res = await fetch('/api/debug/ig-urls', {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: handle }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        const msg = j?.error || j?.message || 'Request failed';
        setError(String(msg));
        return;
      }
      setResult({
        username: j.username || handle,
        urls: j.urls || [],
        count: j.count ?? (j.urls ? j.urls.length : 0),
        stderr: j.stderr,
      });
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function copyUrls() {
    if (!result?.urls?.length) return;
    try {
      await navigator.clipboard.writeText(result.urls.join('\n'));
      alert('Copied URLs to clipboard');
    } catch (e) {
      alert('Copy failed: ' + (e as any)?.message || e);
    }
  }

  function downloadTxt() {
    if (!result?.urls?.length) return;
    const blob = new Blob([result.urls.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.username || 'urls'}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Instagram URL Fetcher</h2>
          <p className="text-sm text-zinc-600">Runs yt-dlp --flat-playlist to list media URLs for a username.</p>
        </div>
        <span className="text-xs text-zinc-500">Requires yt-dlp on server</span>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="border rounded px-3 py-2 text-sm min-w-[240px]"
            placeholder="instagram username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 text-sm min-w-[180px]"
            placeholder="x-dev-secret (optional)"
            value={secret}
            onChange={e => setSecret(e.target.value)}
          />
          <button
            onClick={runFetch}
            className="px-4 py-2 rounded border bg-zinc-900 text-white text-sm disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Fetching…' : 'Fetch URLs'}
          </button>
        </div>
        <p className="text-xs text-zinc-500">Output is not cached; each run calls yt-dlp. Allow ~30s timeout.</p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">{result.username}</span>
            <span className="text-zinc-500">{result.count} URL(s)</span>
            <button className="px-3 py-1 rounded border text-xs" onClick={copyUrls}>Copy</button>
            <button className="px-3 py-1 rounded border text-xs" onClick={downloadTxt}>Download .txt</button>
          </div>
          {result.stderr && <pre className="bg-zinc-50 border text-xs p-2 overflow-auto">{result.stderr}</pre>}
          <div className="border rounded p-2 max-h-72 overflow-auto text-xs space-y-1">
            {result.urls.length === 0 && <div className="text-zinc-500">No URLs returned.</div>}
            {result.urls.map((u, i) => (
              <div key={i} className="break-all">{u}</div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
