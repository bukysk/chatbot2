"use client";

import React, { useEffect, useState } from 'react';

export default function RetrievalDebug(props: any) {
  const external = props || {};
  const [sessions, setSessions] = useState<any[] | null>(external.sessions ?? null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(external.selectedSessionId ?? null);
  const [selectedRecords, setSelectedRecords] = useState<any[] | null>(external.selectedRecords ?? null);
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>(external.expandedChunks ?? {});

  async function listSessions() {
    if (external.listSessions) return external.listSessions();
    try {
      const res = await fetch('/api/debug/sessions');
      if (!res.ok) return alert('Failed to list sessions');
      const j = await res.json();
      setSessions(j.sessions || []);
    } catch (e) {
      alert(String(e));
    }
  }

  async function fetchSession(id?: string) {
    if (external.fetchSession) return external.fetchSession(id);
    try {
      const sid = id || selectedSessionId;
      if (!sid) return alert('Missing session id');
      const res = await fetch(`/api/debug/session/${encodeURIComponent(sid)}?includeTexts=1`);
      if (!res.ok) return alert('Session not found');
      const j = await res.json();
      setSelectedSessionId(sid);
      setSelectedRecords(j.records || []);
    } catch (e) {
      alert(String(e));
    }
  }

  useEffect(() => {
    if (external.sessions === undefined) {
      // don't auto-load unless embedded wants it; leave to user click
    }
  }, []);

  return (
    <section className="card p-4 mb-6">
      <h2 className="text-lg font-medium">Retrieval Debug</h2>
      <p className="text-sm text-zinc-600 mb-3">List and inspect recorded retrieval sessions.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={listSessions} className="px-3 py-2 rounded border">List sessions</button>
        <button onClick={() => fetchSession()} className="px-3 py-2 rounded border">Fetch selected</button>
        <input value={selectedSessionId ?? ''} onChange={e => setSelectedSessionId(e.target.value)} placeholder="session id" className="px-3 py-2 rounded border" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Sessions</strong>
        {sessions && sessions.length > 0 ? (
          <ul>
            {sessions.map((s: any) => (
              <li key={s.id} style={{ marginTop: 6 }}>
                <button onClick={() => fetchSession(s.id)} className="text-sm text-blue-600 underline">{s.id}</button>
                <span style={{ marginLeft: 8, color: '#6b7280' }}>lastSeen: {s.lastSeen} • {s.count} records</span>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: '#6b7280' }}>No sessions loaded. Click "List sessions".</div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        {selectedRecords && selectedRecords.length > 0 ? (
          selectedRecords.slice().reverse().map((r: any, idx: number) => (
            <div key={idx} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{r.timestamp}</div>
              <div style={{ fontWeight: 600 }}>{r.query}</div>
              <div style={{ marginTop: 6 }}>
                {r.chunks.map((c: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, marginBottom: 6 }}>
                    <div style={{ color: '#374151' }}><strong>{c.id}</strong> <span style={{ color: '#6b7280' }}>({c.file})</span> — <span style={{ color: '#065f46' }}>{(c.score||0).toFixed(4)}</span></div>
                        <div style={{ color: '#374151', marginTop: 4 }}>
                          {expandedChunks[c.id] ? (
                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: 0 }}>{c.text || ''}</pre>
                          ) : (
                            <div style={{ fontSize: 13 }}>{String(c.text || '').replace(/\s+/g, ' ').slice(0, 400)}{(c.text||'').length>400 ? '...' : ''}</div>
                          )}
                          {(c.text||'').length > 400 && (
                            <div style={{ marginTop: 6 }}>
                              <button onClick={() => setExpandedChunks((prev: any) => ({ ...prev, [c.id]: !prev[c.id] }))} className="px-2 py-1 rounded border text-sm">
                                {expandedChunks[c.id] ? 'Show less' : 'Show more'}
                              </button>
                            </div>
                          )}
                        </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: '#6b7280' }}>No records loaded for selected session.</div>
        )}
      </div>
    </section>
  );
}
