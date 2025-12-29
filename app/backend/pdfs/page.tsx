"use client";

import React from 'react';
import PdfManager from '../components/PdfManager';
import IndexingCard from '../components/IndexingCard';

export default function PdfsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Database</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
        <PdfManager />
        <IndexingCard />
      </div>
    </div>
  );
}
