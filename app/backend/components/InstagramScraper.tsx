"use client";

import React, { useState, useEffect } from 'react';

interface ScraperStatus {
  running: boolean;
  startedAt: string | null;
  processed: number;
  failed: number;
  skipped: number;
  lastUrl: string | null;
  lastEvent: string | null;
  logs: string[];
  currentUrl: string | null;
  currentUrlIndex: number;
  totalUrls: number;
  currentUsername: string | null;
}

export default function InstagramScraper() {
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  async function fetchStatus() {
    try {
      const headers: Record<string, string> = {};
      if (secret.trim()) headers['x-dev-secret'] = secret.trim();
      
      const res = await fetch('/api/debug/instagram-scraper', { headers });
      const j = await res.json().catch(() => ({}));
      
      if (res.ok && j?.status) {
        setStatus(j.status);
        setError(null);
      } else {
        setError(j?.error || 'Failed to fetch status');
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  async function startScraper() {
    const handle = username.trim();
    if (!handle) return alert('Enter Instagram username');
    
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secret.trim()) headers['x-dev-secret'] = secret.trim();
      
      const res = await fetch('/api/debug/instagram-scraper', {
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
      
      // Start polling for status updates
      if (!pollInterval) {
        const interval = setInterval(fetchStatus, 2000);
        setPollInterval(interval);
      }
      
      // Immediate status fetch
      await fetchStatus();
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    // Initial status fetch
    fetchStatus();
    
    // Auto-poll if scraper is running
    const interval = setInterval(fetchStatus, 3000);
    setPollInterval(interval);
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      clearInterval(interval);
    };
  }, [secret]); // Re-fetch when secret changes

  // Stop polling if scraper is not running
  useEffect(() => {
    if (status && !status.running && pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [status?.running]);

  return (
    <section className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Instagram Account Scraper</h2>
          <p className="text-sm text-zinc-600">
            Scrapes all videos from an Instagram account and transcribes them.
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${
          status?.running ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {status?.running ? 'Running' : 'Idle'}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="border rounded px-3 py-2 text-sm min-w-[240px]"
            placeholder="instagram username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={status?.running}
          />
          <input
            className="border rounded px-3 py-2 text-sm min-w-[180px]"
            placeholder="x-dev-secret (optional)"
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            disabled={status?.running}
          />
          <button
            onClick={startScraper}
            disabled={status?.running || !username.trim()}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status?.running ? 'Running...' : 'Start Scraper'}
          </button>
          <button
            onClick={fetchStatus}
            className="btn-secondary px-4 py-2 text-sm"
          >
            Refresh Status
          </button>
        </div>
      </div>

      {status && (
        <div className="border rounded p-4 space-y-3 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-zinc-500 text-xs">Username</div>
              <div className="font-medium">{status.currentUsername || '—'}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Progress</div>
              <div className="font-medium">
                {status.totalUrls > 0 
                  ? `${status.currentUrlIndex}/${status.totalUrls}`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Processed</div>
              <div className="font-medium text-green-600">{status.processed}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Skipped</div>
              <div className="font-medium text-yellow-600">{status.skipped}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Failed</div>
              <div className="font-medium text-red-600">{status.failed}</div>
            </div>
            <div className="col-span-3">
              <div className="text-zinc-500 text-xs">Last Event</div>
              <div className="font-mono text-xs truncate">{status.lastEvent || '—'}</div>
            </div>
          </div>

          {status.currentUrl && (
            <div>
              <div className="text-zinc-500 text-xs mb-1">Current URL</div>
              <div className="font-mono text-xs bg-white p-2 rounded border break-all">
                {status.currentUrl}
              </div>
            </div>
          )}

          {status.logs.length > 0 && (
            <div>
              <div className="text-zinc-500 text-xs mb-1">Logs (last 10)</div>
              <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-64 overflow-y-auto">
                {status.logs.slice(-10).map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-zinc-500 space-y-1">
        <div>• Requires yt-dlp and transcribe-anything on the server</div>
        <div>• Transcribed videos are saved to data/instagram/[post-id]/</div>
        <div>• Already processed videos are automatically skipped</div>
      </div>
    </section>
  );
}
