"use client";

import React from 'react';
import useIndexing from '../hooks/useIndexing';

export interface IndexingCardProps {
  runRebuild?: () => Promise<any>;
  rebuildLoading?: boolean;
  rebuildMsg?: string | null;
}

export default function IndexingCard(props: IndexingCardProps) {
  const { runRebuild: externalRun, rebuildLoading: externalLoading, rebuildMsg: externalMsg } = props || {};

  const hook = useIndexing();
  const rebuildLoading = externalLoading ?? hook.busy;
  const rebuildMsg = externalMsg ?? hook.msg;
  const runRebuild = externalRun ?? hook.rebuildIndex;

  return (
    <section className="card p-4 mb-6">
      <h2 className="text-lg font-medium">Indexing</h2>
      <p className="text-sm text-zinc-600 mb-3">Run the TypeScript indexer on the server and reload the in-memory index.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => runRebuild().catch(() => {})}
          style={{ background: rebuildLoading ? '#9ca3af' : '#111827', color: '#fff', padding: '8px 12px', borderRadius: 8 }}
        >
          {rebuildLoading ? 'Indexing…' : 'Index PDFs'}
        </button>
        {rebuildMsg && <div style={{ fontSize: 13 }}>{rebuildMsg}</div>}
      </div>
    </section>
  );
}
