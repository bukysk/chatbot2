"use client";

import React, { useState } from 'react';
import Link from 'next/link';

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
  const [chatPromptEditing, setChatPromptEditing] = useState(false);
  const [promptTestResult, setPromptTestResult] = useState<string | null>(null);
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
        return null;
      } else {
        setRuntimeCfg({ overrides: j.overrides || {}, effective: j.effective || {} });
        setCfgMsg('Saved');
        alert('Runtime config saved');
        return j;
      }
    } catch (e: any) {
      setCfgMsg(String(e?.message || e));
      alert('Save error: ' + (e?.message || e));
      return null;
    } finally {
      setCfgLoading(false);
    }
  }

  async function saveAndSendToChat() {
    try {
      setPromptTestResult(null);
      // Save overrides first
      const saved = await saveRuntimeConfig();
      if (!saved) return;
      const effectivePrompt = saved.effective?.PROMPT_TEMPLATE ?? saved.overrides?.PROMPT_TEMPLATE;
      if (!effectivePrompt) return alert('No prompt available to send');

      // Send a small test message to /api/chat using the saved prompt as systemPrompt
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
      setPromptTestResult(text);
      alert('Chat test response received (check panel)');
      setChatPromptEditing(false);
    } catch (e: any) {
      alert('Error sending test chat: ' + (e?.message || e));
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
      <p style={{ marginBottom: 12 }}>Use the sidebar to navigate backend sections.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Link href="/backend/sessions"><div className="card p-4">Sessions</div></Link>
        <Link href="/backend/retrieval"><div className="card p-4">Retrieval</div></Link>
        <Link href="/backend/runtime"><div className="card p-4">Runtime</div></Link>
        <Link href="/backend/pdfs"><div className="card p-4">PDFs</div></Link>
        <Link href="/backend/indexing"><div className="card p-4">Indexing</div></Link>
      </div>
      <div style={{ marginTop: 20 }}>
        <a href="/" className="text-sm text-blue-600 underline">Back to front page</a>
      </div>
    </div>
  );
}
