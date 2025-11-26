"use client";

import React from 'react';
import Link from 'next/link';

export default function OverviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Backend Overview</h1>
      <p style={{ marginBottom: 12 }}>Quick links to backend pages.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Link href="/backend/sessions"><div className="card p-4">Sessions</div></Link>
        <Link href="/backend/retrieval"><div className="card p-4">Retrieval</div></Link>
        <Link href="/backend/runtime"><div className="card p-4">Runtime</div></Link>
        <Link href="/backend/pdfs"><div className="card p-4">PDFs</div></Link>
        <Link href="/backend/indexing"><div className="card p-4">Indexing</div></Link>
      </div>
    </div>
  );
}
