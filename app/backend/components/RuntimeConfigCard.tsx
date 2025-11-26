"use client";

import React, { useEffect, useState } from 'react';

export default function RuntimeConfigCard(props: any) {
  const external = props || {};
  const [runtimeCfg, setRuntimeCfgLocal] = useState<any | null>(external.runtimeCfg ?? null);
  const [cfgMsg, setCfgMsgLocal] = useState<string | null>(external.cfgMsg ?? null);
  const [cfgLoading, setCfgLoadingLocal] = useState<boolean>(external.cfgLoading ?? false);

  async function fetchRuntimeConfig() {
    if (external.fetchRuntimeConfig) return external.fetchRuntimeConfig();
    try {
      setCfgLoadingLocal(true);
      const res = await fetch('/api/debug/runtime-config');
      if (!res.ok) return alert('Failed to load runtime config');
      const j = await res.json();
      setRuntimeCfgLocal(j || {});
    } catch (e) {
      alert(String(e));
    } finally {
      setCfgLoadingLocal(false);
    }
  }

  async function saveRuntimeConfig() {
    if (external.saveRuntimeConfig) return external.saveRuntimeConfig();
    try {
      const secret = window.prompt('Enter DEV_DEBUG_SECRET (leave empty if none)');
      setCfgMsgLocal(null);
      setCfgLoadingLocal(true);
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (secret) headers['x-dev-secret'] = secret;
      const body = runtimeCfg?.overrides || {};
      const res = await fetch('/api/debug/runtime-config', { method: 'POST', headers, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = j?.error || j?.message || 'Save failed';
        setCfgMsgLocal(String(err));
        alert('Save failed: ' + err);
        return null;
      } else {
        setRuntimeCfgLocal({ overrides: j.overrides || {}, effective: j.effective || {} });
        setCfgMsgLocal('Saved');
        alert('Runtime config saved');
        return j;
      }
    } catch (e: any) {
      setCfgMsgLocal(String(e?.message || e));
      alert('Save error: ' + (e?.message || e));
      return null;
    } finally {
      setCfgLoadingLocal(false);
    }
  }

  useEffect(() => { if (!external.runtimeCfg) fetchRuntimeConfig(); }, []);

  return (
    <section className="card p-4 mb-6">
      <h2 className="text-lg font-medium">Runtime Config</h2>
      <p className="text-sm text-zinc-600 mb-3">View and override local runtime parameters (development only).</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <button onClick={fetchRuntimeConfig} style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Load config</button>
        <button onClick={saveRuntimeConfig} style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Save overrides</button>
        {cfgMsg && <div style={{ color: '#6b7280' }}>{cfgMsg}</div>}
      </div>

      {runtimeCfg ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="text-sm font-medium">Embedding Model</label>
            <input value={runtimeCfg?.overrides?.EMBEDDING_MODEL ?? runtimeCfg?.effective?.EMBEDDING_MODEL ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), EMBEDDING_MODEL: e.target.value } }))} className="px-3 py-2 rounded border w-full" />
          </div>
          <div>
            <label className="text-sm font-medium">Top K</label>
            <input type="number" value={runtimeCfg?.overrides?.TOP_K ?? runtimeCfg?.effective?.TOP_K ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), TOP_K: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
          </div>
          <div>
            <label className="text-sm font-medium">Chat Temperature</label>
            <input type="number" step="0.01" value={runtimeCfg?.overrides?.CHAT_TEMPERATURE ?? runtimeCfg?.effective?.CHAT_TEMPERATURE ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), CHAT_TEMPERATURE: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
          </div>
          <div>
            <label className="text-sm font-medium">Include Subject Context (true/false)</label>
            <input value={(runtimeCfg?.overrides?.INCLUDE_SUBJECT_CONTEXT ?? runtimeCfg?.effective?.INCLUDE_SUBJECT_CONTEXT ?? '')?.toString()} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), INCLUDE_SUBJECT_CONTEXT: e.target.value } }))} className="px-3 py-2 rounded border w-full" />
          </div>
          <div>
            <label className="text-sm font-medium">Chunk Size</label>
            <input type="number" value={runtimeCfg?.overrides?.CHUNK_SIZE ?? runtimeCfg?.effective?.CHUNK_SIZE ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), CHUNK_SIZE: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
          </div>
          <div>
            <label className="text-sm font-medium">Chunk Overlap</label>
            <input type="number" value={runtimeCfg?.overrides?.CHUNK_OVERLAP ?? runtimeCfg?.effective?.CHUNK_OVERLAP ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), CHUNK_OVERLAP: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
          </div>
          <div>
            <label className="text-sm font-medium">Min Chunk Length</label>
            <input type="number" value={runtimeCfg?.overrides?.MIN_CHUNK_LENGTH ?? runtimeCfg?.effective?.MIN_CHUNK_LENGTH ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), MIN_CHUNK_LENGTH: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
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
  );
}
