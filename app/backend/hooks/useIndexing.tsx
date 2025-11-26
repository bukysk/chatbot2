"use client";

import { useState } from 'react';

export default function useIndexing() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function rebuildIndex() {
    setBusy(true);
    setMsg(null);
    try {
      const secret = window.prompt('Enter DEV_DEBUG_SECRET (leave empty if none)');
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (secret) headers['x-dev-secret'] = secret;
      const res = await fetch('/api/debug/rebuild-index', { method: 'POST', headers });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || j?.message || 'Rebuild failed');
      setMsg(j?.message || 'Index rebuild started');
      return j;
    } finally {
      setBusy(false);
    }
  }

  return { busy, msg, rebuildIndex } as const;
}
