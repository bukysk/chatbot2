"use client";

import React, { useState } from 'react';

export default function AdhocRetrieval(props: any) {
  const external = props || {};
  const [retrievalMode, setRetrievalMode] = useState(external.retrievalMode ?? 'rag');
  const [adhocQuery, setAdhocQuery] = useState(external.adhocQuery ?? '');
  const [adhocResults, setAdhocResults] = useState<any[] | null>(external.adhocResults ?? null);
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>(external.expandedChunks ?? {});

  async function runAdhocRetrieval() {
    if (external.runAdhocRetrieval) return external.runAdhocRetrieval();
    try {
      if (!adhocQuery || !adhocQuery.trim()) return alert('Enter a query');
      const body = { query: adhocQuery, mode: retrievalMode };
      const res = await fetch('/api/debug/used-chunks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) return alert('Retrieval failed');
      const j = await res.json();
      setAdhocResults(j.chunks || []);
    } catch (e) {
      alert(String(e));
    }
  }

  return (
    <section className="card p-4 mb-6">
      <h2 className="text-lg font-medium">Ad-hoc Retrieval</h2>
      <p className="text-sm text-zinc-600 mb-3">Run a one-off retrieval against the index (modes: rag/hybrid/centroid/detailed).</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <select value={retrievalMode} onChange={e => setRetrievalMode(e.target.value as any)} className="px-3 py-2 rounded border">
          <option value="rag">RAG (no centroids)</option>
          <option value="hybrid">Hybrid (centroid + query)</option>
          <option value="centroid">Centroid-only</option>
          <option value="detailed">Detailed (query-only)</option>
        </select>
        <input value={adhocQuery} onChange={e => setAdhocQuery(e.target.value)} placeholder="Ad-hoc query" className="px-3 py-2 rounded border flex-1" />
        <button onClick={runAdhocRetrieval} className="px-3 py-2 rounded border">Run retrieval</button>
      </div>
      <div style={{ marginTop: 8 }}>
        <h4 className="text-sm font-medium">Results</h4>
        {adhocResults && adhocResults.length > 0 ? (
          adhocResults.map((c: any, i: number) => (
            <div key={i} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{c.id}</div>
              <div style={{ fontWeight: 600 }}>{c.file} — {(c.score||0).toFixed(4)}</div>
              <div style={{ marginTop: 6 }}>
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
          ))
        ) : (
          <div style={{ color: '#6b7280' }}>No ad-hoc results. Run retrieval above.</div>
        )}
      </div>
    </section>
  );
}
