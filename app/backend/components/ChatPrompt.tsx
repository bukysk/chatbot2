"use client";

import React, { useEffect, useState } from 'react';

export default function ChatPrompt(props: any) {
  const external = props || {};
  const [runtimeCfg, setRuntimeCfgLocal] = useState<any | null>(external.runtimeCfg ?? null);
  const [chatPromptEditing, setChatPromptEditingLocal] = useState<boolean>(external.chatPromptEditing ?? false);
  const [promptTestResult, setPromptTestResultLocal] = useState<string | null>(external.promptTestResult ?? null);

  async function fetchRuntimeConfig() {
    if (external.fetchRuntimeConfig) return external.fetchRuntimeConfig();
    try {
      const res = await fetch('/api/debug/runtime-config');
      if (!res.ok) return alert('Failed to load runtime config');
      const j = await res.json();
      setRuntimeCfgLocal(j || {});
    } catch (e) {
      alert(String(e));
    }
  }

  async function saveRuntimeConfig() {
    if (external.saveRuntimeConfig) return external.saveRuntimeConfig();
    try {
      const secret = window.prompt('Enter DEV_DEBUG_SECRET (leave empty if none)');
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (secret) headers['x-dev-secret'] = secret;
      const body = runtimeCfg?.overrides || {};
      const res = await fetch('/api/debug/runtime-config', { method: 'POST', headers, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = j?.error || j?.message || 'Save failed';
        alert('Save failed: ' + err);
        return null;
      } else {
        setRuntimeCfgLocal({ overrides: j.overrides || {}, effective: j.effective || {} });
        alert('Runtime config saved');
        return j;
      }
    } catch (e: any) {
      alert('Save error: ' + (e?.message || e));
      return null;
    }
  }

  async function saveAndSendToChat() {
    if (external.saveAndSendToChat) return external.saveAndSendToChat();
    try {
      setPromptTestResultLocal(null);
      const saved = await saveRuntimeConfig();
      if (!saved) return;
      const effectivePrompt = saved.effective?.PROMPT_TEMPLATE ?? saved.overrides?.PROMPT_TEMPLATE;
      if (!effectivePrompt) return alert('No prompt available to send');

      const testMsg = { role: 'user', content: 'Please acknowledge this system prompt by replying with: PROMPT_OK' };
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [testMsg], systemPrompt: effectivePrompt }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => 'Failed to read response');
        return alert('Chat test failed: ' + txt);
      }
      const text = await res.text();
      setPromptTestResultLocal(text);
      alert('Chat test response received (check panel)');
      setChatPromptEditingLocal(false);
    } catch (e: any) {
      alert('Error sending test chat: ' + (e?.message || e));
    }
  }

  useEffect(() => { if (!external.runtimeCfg) fetchRuntimeConfig(); }, []);

  return (
    <section className="card p-4 mb-6">
      <h2 className="text-lg font-medium">Chat & Prompt</h2>
      <p className="text-sm text-zinc-600 mb-3">Edit the chat model, temperature, whether subject context is included, and the system prompt template (dev only).</p>
      {runtimeCfg ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <div>
            <label className="text-sm font-medium">Chat Model</label>
            <input value={runtimeCfg?.overrides?.CHAT_MODEL ?? runtimeCfg?.effective?.CHAT_MODEL ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), CHAT_MODEL: e.target.value } }))} className="px-3 py-2 rounded border w-full" />
          </div>
          <div>
            <label className="text-sm font-medium">Chat Temperature</label>
            <input type="number" step="0.01" value={runtimeCfg?.overrides?.CHAT_TEMPERATURE ?? runtimeCfg?.effective?.CHAT_TEMPERATURE ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), CHAT_TEMPERATURE: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" />
          </div>
          <div>
            <label className="text-sm font-medium">Include Subject Context (true/false)</label>
            <select value={(runtimeCfg?.overrides?.INCLUDE_SUBJECT_CONTEXT ?? runtimeCfg?.effective?.INCLUDE_SUBJECT_CONTEXT ?? '')?.toString()} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), INCLUDE_SUBJECT_CONTEXT: e.target.value } }))} className="px-3 py-2 rounded border w-full">
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">System Prompt Template</label>
            {!chatPromptEditing ? (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#fff' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: 0 }}>{runtimeCfg?.overrides?.PROMPT_TEMPLATE ?? runtimeCfg?.effective?.PROMPT_TEMPLATE ?? ''}</pre>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={() => setChatPromptEditingLocal(true)} style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                  <button onClick={() => { navigator.clipboard?.writeText((runtimeCfg?.overrides?.PROMPT_TEMPLATE ?? runtimeCfg?.effective?.PROMPT_TEMPLATE) || ''); alert('Prompt copied to clipboard'); }} style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Copy</button>
                </div>
              </div>
            ) : (
              <div>
                <textarea rows={8} className="w-full rounded-lg border px-3 py-2 text-sm" value={runtimeCfg?.overrides?.PROMPT_TEMPLATE ?? runtimeCfg?.effective?.PROMPT_TEMPLATE ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), PROMPT_TEMPLATE: e.target.value } }))} />
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={async () => { await saveRuntimeConfig(); setChatPromptEditingLocal(false); }} style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Save</button>
                  <button onClick={saveAndSendToChat} style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Save and send</button>
                  <button onClick={() => { setChatPromptEditingLocal(false); fetchRuntimeConfig(); }} style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#374151', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {promptTestResult && (
              <div style={{ marginTop: 8, border: '1px solid #eaeaea', padding: 8, borderRadius: 6 }}>
                <strong>Chat test result:</strong>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 6 }}>{promptTestResult}</pre>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fetchRuntimeConfig} className="px-3 py-2 rounded border">Reload</button>
            <div style={{ color: '#6b7280' }}>Changes are saved to <code>data/local_config.json</code>. Changing prompt/model may require re-running indexing.</div>
          </div>
        </div>
      ) : (
        <div style={{ color: '#6b7280' }}>{'Load config to edit chat/prompt.'}</div>
      )}
    </section>
  );
}
