"use client";

import React from 'react';
import PdfManager from '../components/PdfManager';
import IndexingCard from '../components/IndexingCard';

export default function PdfsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">PDF Management</h1>
      <PdfManager />
    </div>
  );
}
