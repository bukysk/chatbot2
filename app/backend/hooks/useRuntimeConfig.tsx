"use client";

import { useState } from 'react';

export type RuntimeCfg = {
  overrides?: Record<string, any>;
  effective?: Record<string, any>;
};

export default function useRuntimeConfig(initial?: RuntimeCfg) {
  const [runtimeCfg, setRuntimeCfg] = useState<RuntimeCfg | null>(initial ?? null);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);

  async function fetchRuntimeConfig() {
    setCfgLoading(true);
    try {
      const res = await fetch('/api/debug/runtime-config');
      if (!res.ok) throw new Error('Failed to load runtime config');
      const j = await res.json();
      setRuntimeCfg(j || {});
      return j;
    } finally {
      setCfgLoading(false);
    }
  }

  async function saveRuntimeConfig(overrides?: Record<string, any>) {
    setCfgLoading(true);
    setCfgMsg(null);
    try {
      const secret = window.prompt('Enter DEV_DEBUG_SECRET (leave empty if none)');
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (secret) headers['x-dev-secret'] = secret;
      const body = overrides ?? runtimeCfg?.overrides ?? {};
      const res = await fetch('/api/debug/runtime-config', { method: 'POST', headers, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = j?.error || j?.message || 'Save failed';
        setCfgMsg(String(err));
        throw new Error(String(err));
      }
      setRuntimeCfg({ overrides: j.overrides || {}, effective: j.effective || {} });
      setCfgMsg('Saved');
      return j;
    } finally {
      setCfgLoading(false);
    }
  }

  return { runtimeCfg, setRuntimeCfg, cfgLoading, cfgMsg, fetchRuntimeConfig, saveRuntimeConfig } as const;
}
