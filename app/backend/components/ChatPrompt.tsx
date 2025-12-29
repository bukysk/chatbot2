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
    <section className="card p-4 mb-6" style={{ background: '#0a0a0a', borderColor: '#1f1f1f', color: '#e5e7eb' }}>
      <h2 className="text-lg font-medium">Chat & Prompt</h2>
      <p className="text-sm mb-3" style={{ color: '#9ca3af' }}>Edit the chat model, temperature, whether subject context is included, and the system prompt template (dev only).</p>
      {runtimeCfg ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <div>
            <label className="text-sm font-medium">Chat Model</label>
            <input value={runtimeCfg?.overrides?.CHAT_MODEL ?? runtimeCfg?.effective?.CHAT_MODEL ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), CHAT_MODEL: e.target.value } }))} className="px-3 py-2 rounded border w-full" style={{ background: '#0f0f0f', borderColor: '#2a2a2a', color: '#f5f5f5' }} />
          </div>
          <div>
            <label className="text-sm font-medium">Chat Temperature</label>
            <input type="number" step="0.01" value={runtimeCfg?.overrides?.CHAT_TEMPERATURE ?? runtimeCfg?.effective?.CHAT_TEMPERATURE ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), CHAT_TEMPERATURE: Number(e.target.value) } }))} className="px-3 py-2 rounded border w-full" style={{ background: '#0f0f0f', borderColor: '#2a2a2a', color: '#f5f5f5' }} />
          </div>
          <div>
            <label className="text-sm font-medium">Include Subject Context (true/false)</label>
            <select value={(runtimeCfg?.overrides?.INCLUDE_SUBJECT_CONTEXT ?? runtimeCfg?.effective?.INCLUDE_SUBJECT_CONTEXT ?? '')?.toString()} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), INCLUDE_SUBJECT_CONTEXT: e.target.value } }))} className="px-3 py-2 rounded border w-full" style={{ background: '#0f0f0f', borderColor: '#2a2a2a', color: '#f5f5f5' }}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">System Prompt Template</label>
            {!chatPromptEditing ? (
              <div style={{ border: '1px solid #2a2a2a', borderRadius: 6, padding: 8, background: '#0f0f0f', color: '#f5f5f5' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: 0, color: '#e5e7eb' }}>{runtimeCfg?.overrides?.PROMPT_TEMPLATE ?? runtimeCfg?.effective?.PROMPT_TEMPLATE ?? ''}</pre>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={() => setChatPromptEditingLocal(true)} style={{ background: '#ff6b35', border: '1px solid #ff8555', color: '#0b0b0b', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Edit</button>
                  <button onClick={() => { navigator.clipboard?.writeText((runtimeCfg?.overrides?.PROMPT_TEMPLATE ?? runtimeCfg?.effective?.PROMPT_TEMPLATE) || ''); alert('Prompt copied to clipboard'); }} style={{ background: '#ff6b35', border: '1px solid #ff8555', color: '#0b0b0b', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Copy</button>
                </div>
              </div>
            ) : (
              <div>
                <textarea rows={8} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: '#0f0f0f', borderColor: '#2a2a2a', color: '#f5f5f5' }} value={runtimeCfg?.overrides?.PROMPT_TEMPLATE ?? runtimeCfg?.effective?.PROMPT_TEMPLATE ?? ''} onChange={e => setRuntimeCfgLocal((prev: any) => ({ ...prev, overrides: { ...(prev?.overrides||{}), PROMPT_TEMPLATE: e.target.value } }))} />
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={async () => { await saveRuntimeConfig(); setChatPromptEditingLocal(false); }} style={{ background: '#ff6b35', border: '1px solid #ff8555', color: '#0b0b0b', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Save</button>
                  <button onClick={saveAndSendToChat} style={{ background: '#ff6b35', border: '1px solid #ff8555', color: '#0b0b0b', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Save and send</button>
                  <button onClick={() => { setChatPromptEditingLocal(false); fetchRuntimeConfig(); }} style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', color: '#e5e7eb', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {promptTestResult && (
              <div style={{ marginTop: 8, border: '1px solid #2a2a2a', padding: 8, borderRadius: 6, background: '#0f0f0f', color: '#e5e7eb' }}>
                <strong>Chat test result:</strong>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 6 }}>{promptTestResult}</pre>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fetchRuntimeConfig} className="px-3 py-2 rounded border" style={{ background: '#0f0f0f', borderColor: '#2a2a2a', color: '#e5e7eb' }}>Reload</button>
            <div style={{ color: '#9ca3af' }}>Changes are saved to <code>data/local_config.json</code>. Changing prompt/model may require re-running indexing.</div>
          </div>
        </div>
      ) : (
        <div style={{ color: '#9ca3af' }}>{'Load config to edit chat/prompt.'}</div>
      )}
    </section>
  );
}
