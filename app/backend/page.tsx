"use client";

import React, { useState } from 'react';

export default function BackendToolsPage() {
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<any[] | null>(null);
  const [retrievalMode, setRetrievalMode] = useState<'rag'|'hybrid'|'centroid'|'detailed'>('rag');
  const [adhocQuery, setAdhocQuery] = useState<string>('');
  const [adhocResults, setAdhocResults] = useState<any[] | null>(null);
  const [pdfs, setPdfs] = useState<{name:string,size:number|null,mtime:string|null}[] | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [runtimeCfg, setRuntimeCfg] = useState<any | null>(null);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>({});

  async function runRebuild() {
    try {
      const secret = window.prompt('Enter DEV_DEBUG_SECRET (leave empty if none)');
      setRebuildLoading(true);
      setRebuildMsg(null);
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (secret) headers['x-dev-secret'] = secret;
      const res = await fetch('/api/debug/rebuild-index', { method: 'POST', headers });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = j?.error || j?.message || 'Rebuild failed';
        setRebuildMsg(String(err));
        alert('Rebuild failed: ' + err);
      } else {
        const chunks = j?.chunks ?? null;
        setRebuildMsg(chunks !== null ? `Rebuild finished, chunks: ${chunks}` : 'Rebuild finished');
        alert('Rebuild finished. ' + (chunks !== null ? `chunks: ${chunks}` : ''));
      }
    } catch (e: any) {
      setRebuildMsg(String(e?.message || e));
      alert('Rebuild error: ' + (e?.message || e));
    } finally {
      setRebuildLoading(false);
    }
  }

  async function listSessions() {
    try {
      const res = await fetch('/api/debug/sessions');
      if (!res.ok) return alert('Failed to list sessions');
      const j = await res.json();
      setSessions(j.sessions || []);
    } catch (e) {
      alert(String(e));
    }
  }

  async function listPdfs() {
    try {
      const res = await fetch('/api/debug/list-pdfs');
      if (!res.ok) return alert('Failed to list PDFs');
      const j = await res.json();
      setPdfs(j.files || []);
    } catch (e) {
      alert(String(e));
    }
  }

  async function fetchRuntimeConfig() {
    try {
      setCfgLoading(true);
      const res = await fetch('/api/debug/runtime-config');
      if (!res.ok) return alert('Failed to load runtime config');
      const j = await res.json();
      setRuntimeCfg(j || {});
    } catch (e) {
      alert(String(e));
    } finally {
      setCfgLoading(false);
    }
  }

  async function saveRuntimeConfig() {
    try {
      const secret = window.prompt('Enter DEV_DEBUG_SECRET (leave empty if none)');
      setCfgMsg(null);
      setCfgLoading(true);
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (secret) headers['x-dev-secret'] = secret;
      // send only overrides (flat map)
      const body = runtimeCfg?.overrides || {};
      const res = await fetch('/api/debug/runtime-config', { method: 'POST', headers, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = j?.error || j?.message || 'Save failed';
        setCfgMsg(String(err));
        alert('Save failed: ' + err);
      } else {
        setRuntimeCfg({ overrides: j.overrides || {}, effective: j.effective || {} });
        setCfgMsg('Saved');
        alert('Runtime config saved');
      }
    } catch (e: any) {
      setCfgMsg(String(e?.message || e));
      alert('Save error: ' + (e?.message || e));
    } finally {
      setCfgLoading(false);
    }
  }

  async function fetchSession(id?: string) {
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

  async function runAdhocRetrieval() {
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-4">Backend / Dev Tools</h1>
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
                                <button onClick={() => setExpandedChunks(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="px-2 py-1 rounded border text-sm">
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
        {/* Ad-hoc retrieval results */}
        {/* Ad-hoc retrieval results removed */}
        
      </section>

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
                      <button onClick={() => setExpandedChunks(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="px-2 py-1 rounded border text-sm">
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

      <section className="card p-4 mb-6">
        <h2 className="text-lg font-medium">Indexing</h2>
        <p className="text-sm text-zinc-600 mb-3">Run the TypeScript indexer on the server and reload the in-memory index.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={runRebuild}
            style={{ background: rebuildLoading ? '#9ca3af' : '#111827', color: '#fff', padding: '8px 12px', borderRadius: 8 }}
          >
            {rebuildLoading ? 'Indexing…' : 'Index PDFs'}
          </button>
          {rebuildMsg && <div style={{ fontSize: 13 }}>{rebuildMsg}</div>}
        </div>
      </section>
      
      <section className="card p-4 mb-6">
        <h2 className="text-lg font-medium">Runtime Config</h2>
        <p className="text-sm text-zinc-600 mb-3">View and override local runtime parameters (development only).</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <button onClick={fetchRuntimeConfig} className="px-3 py-2 rounded border">Load config</button>
          <button onClick={saveRuntimeConfig} className="px-3 py-2 rounded border">Save overrides</button>
          {cfgMsg && <div style={{ color: '#6b7280' }}>{cfgMsg}</div>}
        </div>

        {runtimeCfg ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="text-sm font-medium">Embedding Model</label>
              <input value={runtimeCfg?.overrides?.EMBEDDING_MODEL ?? runtimeCfg?.effective?.EMBEDDING_MODEL ?? ''} onChange={e => setRuntimeCfg((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), EMBEDDING_MODEL: e.target.value } }))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm font-medium">Top K</label>
              <input type="number" value={runtimeCfg?.overrides?.TOP_K ?? runtimeCfg?.effective?.TOP_K ?? ''} onChange={e => setRuntimeCfg((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), TOP_K: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm font-medium">Chat Temperature</label>
              <input type="number" step="0.01" value={runtimeCfg?.overrides?.CHAT_TEMPERATURE ?? runtimeCfg?.effective?.CHAT_TEMPERATURE ?? ''} onChange={e => setRuntimeCfg((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), CHAT_TEMPERATURE: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm font-medium">Include Subject Context (true/false)</label>
              <input value={(runtimeCfg?.overrides?.INCLUDE_SUBJECT_CONTEXT ?? runtimeCfg?.effective?.INCLUDE_SUBJECT_CONTEXT ?? '')?.toString()} onChange={e => setRuntimeCfg((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), INCLUDE_SUBJECT_CONTEXT: e.target.value } }))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm font-medium">Chunk Size</label>
              <input type="number" value={runtimeCfg?.overrides?.CHUNK_SIZE ?? runtimeCfg?.effective?.CHUNK_SIZE ?? ''} onChange={e => setRuntimeCfg((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), CHUNK_SIZE: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm font-medium">Chunk Overlap</label>
              <input type="number" value={runtimeCfg?.overrides?.CHUNK_OVERLAP ?? runtimeCfg?.effective?.CHUNK_OVERLAP ?? ''} onChange={e => setRuntimeCfg((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), CHUNK_OVERLAP: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm font-medium">Min Chunk Length</label>
              <input type="number" value={runtimeCfg?.overrides?.MIN_CHUNK_LENGTH ?? runtimeCfg?.effective?.MIN_CHUNK_LENGTH ?? ''} onChange={e => setRuntimeCfg((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), MIN_CHUNK_LENGTH: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm font-medium">(Note)</label>
              <div style={{ color: '#6b7280', fontSize: 13 }}>Changing embedding model requires running rebuild-index to regenerate embeddings.</div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#6b7280' }}>{cfgLoading ? 'Loading...' : 'Load config to edit runtime overrides.'}</div>
        )}
      </section>
      
      <section className="card p-4 mb-6">
        <h2 className="text-lg font-medium">Available PDFs</h2>
        <p className="text-sm text-zinc-600 mb-3">PDFs found in <code>data/pdfs</code>. Use this to confirm which files will be indexed.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <button onClick={listPdfs} className="px-3 py-2 rounded border">List PDFs</button>
          <button onClick={() => { setPdfs(null); listPdfs(); }} className="px-3 py-2 rounded border">Refresh</button>
          {pdfs && <div style={{ color: '#6b7280' }}>{pdfs.length} file(s)</div>}
        </div>

        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <label className="text-sm font-medium">Import PDF</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <input id="pdf-file-input" type="file" accept="application/pdf" style={{ display: 'none' }} />
            <label
              htmlFor="pdf-file-input"
              style={{
                background: '#fffbeb',
                border: '1px solid #f59e0b',
                color: '#92400e',
                padding: '8px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Vybrať súbor
            </label>
            <span id="pdf-selected-name" style={{ color: '#6b7280', fontSize: 13 }}>{/* filename appears here */}</span>
            <button
              onClick={async () => {
                const input = document.getElementById('pdf-file-input') as HTMLInputElement | null;
                const file = input?.files?.[0];
                if (!file) return alert('Select a PDF file first');
                if (!file.name.toLowerCase().endsWith('.pdf')) return alert('Only PDF files allowed');
                try {
                  setUploadLoading(true);
                  setUploadMsg(null);
                  // update visible filename
                  const nameSpan = document.getElementById('pdf-selected-name');
                  if (nameSpan) nameSpan.textContent = file.name;

                  const dataUrl = await new Promise<string>((resolve, reject) => {
                    const fr = new FileReader();
                    fr.onerror = () => reject(new Error('Failed to read file'));
                    fr.onload = () => resolve(String(fr.result || ''));
                    fr.readAsDataURL(file);
                  });
                  const secret = window.prompt('Enter DEV_DEBUG_SECRET (leave empty if none)');
                  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
                  if (secret) headers['x-dev-secret'] = secret;
                  const res = await fetch('/api/debug/import-pdf', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: file.name, content: dataUrl }),
                  });
                  const j = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    const err = j?.error || j?.message || 'Upload failed';
                    setUploadMsg(String(err));
                    alert('Upload failed: ' + err);
                  } else {
                    setUploadMsg(`Uploaded ${j.name} (${(j.size/1024).toFixed(1)} KB)`);
                    alert('Upload successful: ' + j.name);
                    // refresh list
                    listPdfs();
                  }
                } catch (e: any) {
                  setUploadMsg(String(e?.message || e));
                  alert('Upload error: ' + (e?.message || e));
                } finally {
                  setUploadLoading(false);
                }
              }}
              className="px-3 py-2 rounded border"
            >
              {uploadLoading ? 'Uploading…' : 'Import PDF'}
            </button>
            {uploadMsg && <div style={{ color: '#6b7280' }}>{uploadMsg}</div>}
          </div>
        </div>

        {pdfs && pdfs.length > 0 ? (
          <ul style={{ marginTop: 8 }}>
            {pdfs.map(p => (
              <li key={p.name} style={{ padding: '6px 0', borderBottom: '1px solid #f1f1f1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 13 }} title={p.name}>{p.name}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{p.size !== null ? `${(p.size/1024).toFixed(1)} KB` : '—'} • {p.mtime ?? '—'}</div>
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                  <button className="px-2 py-1 rounded border text-sm" onClick={() => { navigator.clipboard?.writeText(p.name); alert('Copied filename to clipboard'); }}>Copy name</button>
                  <button className="px-2 py-1 rounded border text-sm" onClick={async () => {
                    const ok = confirm(`Delete ${p.name}? This will remove the file from data/pdfs.`);
                    if (!ok) return;
                    try {
                      const secret = window.prompt('Enter DEV_DEBUG_SECRET (leave empty if none)');
                      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
                      if (secret) headers['x-dev-secret'] = secret;
                      const res = await fetch('/api/debug/delete-pdf', { method: 'POST', headers, body: JSON.stringify({ name: p.name }) });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        const err = j?.error || j?.message || 'Delete failed';
                        alert('Delete failed: ' + err);
                      } else {
                        alert('Deleted: ' + j.name + '. You should re-run Index PDFs to update embeddings.');
                        listPdfs();
                      }
                    } catch (e) {
                      alert(String(e));
                    }
                  }}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: '#6b7280', marginTop: 8 }}>No PDFs listed. Click "List PDFs".</div>
        )}
      </section>

      <div style={{ marginTop: 20 }}>
        <a href="/" className="text-sm text-blue-600 underline">Back to front page</a>
      </div>
    </div>
  );
}
