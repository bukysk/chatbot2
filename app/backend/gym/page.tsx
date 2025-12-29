"use client";

import React, { useEffect, useRef, useState } from 'react';

interface GymStatus {
  running: boolean;
  startedAt: string | null;
  processed: number;
  failed: number;
  lastFile: string | null;
  lastEvent: string | null;
  logs: string[];
  currentUrl: string | null;
  currentUrlIndex: number;
  totalUrls: number;
}

const POLL_MS = 2000;

export default function GymWatcherPage() {
  const [status, setStatus] = useState<GymStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/debug/gym-watcher', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load status');
      const j = await res.json();
      setStatus(j.status || null);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function startWatcher() {
    try {
      setLoading(true);
      const res = await fetch('/api/debug/gym-watcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Failed to start');
      setStatus(j.status || null);
    } catch (err: any) {
      alert(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function stopWatcher() {
    try {
      setLoading(true);
      const res = await fetch('/api/debug/gym-watcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Failed to stop');
      setStatus(j.status || null);
    } catch (err: any) {
      alert(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    timerRef.current = setInterval(() => fetchStatus(), POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const running = status?.running;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-4">Gym watcher</h1>
      <p className="text-sm text-zinc-600 mb-4">
        Watch <code>data/gym</code> for incoming .txt files and process them one by one. Use the button below to start/stop the watcher and monitor progress.
      </p>

      <section className="card p-4 mb-6" style={{ background: '#0a0a0a', borderColor: '#1f1f1f', color: '#e5e7eb' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={running ? stopWatcher : startWatcher}
            style={{
              background: running ? '#b91c1c' : '#ff6b35',
              color: running ? '#fff' : '#0b0b0b',
              padding: '10px 14px',
              borderRadius: 10,
              minWidth: 140
            }}
            disabled={loading}
          >
            {loading ? 'Working…' : running ? 'Stop watcher' : 'Start watcher'}
          </button>
          <button
            onClick={() => fetchStatus()}
            className="px-3 py-2 rounded border"
            style={{ background: '#0f0f0f', borderColor: '#2a2a2a', color: '#e5e7eb' }}
            disabled={loading}
          >
            Refresh
          </button>
          <div style={{ padding: '6px 10px', borderRadius: 8, background: running ? '#dcfce7' : '#f8fafc', color: running ? '#166534' : '#475569' }}>
            {running ? 'Running' : 'Stopped'}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <Metric label="Processed" value={status?.processed ?? 0} />
          <Metric label="Failed" value={status?.failed ?? 0} />
          <Metric label="Last file" value={status?.lastFile ?? '—'} small />
          <Metric label="Last event" value={status?.lastEvent ?? '—'} small />
          <Metric label="Started" value={status?.startedAt ? new Date(status.startedAt).toLocaleTimeString() : '—'} small />
          {status?.totalUrls ? <Metric label="Progress" value={`${status.currentUrlIndex}/${status.totalUrls}`} small /> : null}
        </div>
        
        {status?.currentUrl && (
          <div style={{ marginTop: 12, padding: 10, background: '#fef3c7', borderRadius: 8, border: '1px solid #fbbf24' }}>
            <div className="text-sm font-medium text-amber-900">Currently scraping:</div>
            <div style={{ fontSize: 13, color: '#78350f', wordBreak: 'break-all', marginTop: 4 }}>{status.currentUrl}</div>
          </div>
        )}
      </section>

      <section className="card p-4" style={{ background: '#0a0a0a', borderColor: '#1f1f1f', color: '#e5e7eb' }}>
        <h3 className="text-lg font-medium mb-2">Activity log</h3>
        <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #2a2a2a', borderRadius: 8, padding: 8, background: '#0f0f0f', color: '#e5e7eb' }}>
          {status?.logs?.length ? (
            <ul style={{ fontFamily: 'ui-monospace, SFMono-Regular', fontSize: 13, lineHeight: 1.5 }}>
              {status.logs.slice().reverse().map((l, idx) => (
                <li key={idx} style={{ padding: '3px 0' }}>{l}</li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#9ca3af' }}>No activity yet. Drop a .txt into <code>data/gym</code> and start the watcher.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 10, padding: '10px 12px', color: '#e5e7eb' }}>
      <div className="text-sm" style={{ color: '#9ca3af' }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 20, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
