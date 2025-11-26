"use client";

import React, { useEffect, useRef } from 'react';
import usePdfs from '../hooks/usePdfs';

export interface PdfManagerProps {
  pdfs?: any[];
  listPdfs?: () => Promise<any[]>;
  importPdf?: (f: File) => Promise<any>;
  deletePdf?: (name: string) => Promise<any>;
  uploadLoading?: boolean;
  uploadMsg?: string | null;
}

export default function PdfManager(props: PdfManagerProps) {
  const { pdfs: initial, listPdfs: externalList, importPdf: externalImport, deletePdf: externalDelete, uploadLoading: externalUploadLoading, uploadMsg: externalUploadMsg } = props || {};

  const hook = usePdfs(initial);
  const pdfs = initial ?? hook.pdfs;
  const listPdfs = externalList ?? hook.listPdfs;
  const importPdf = externalImport ?? hook.importPdf;
  const deletePdf = externalDelete ?? hook.deletePdf;
  const uploadLoading = externalUploadLoading ?? hook.uploadLoading;
  const uploadMsg = externalUploadMsg ?? hook.uploadMsg;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (!initial) listPdfs().catch(() => {}); }, []);

  async function onImportClick() {
    const input = fileInputRef.current;
    const file = input?.files?.[0];
    if (!file) return alert('Select a PDF file first');
    if (!file.name.toLowerCase().endsWith('.pdf')) return alert('Only PDF files allowed');
    try {
      await importPdf(file);
      alert('Upload finished');
      await listPdfs();
    } catch (e: any) {
      alert('Upload error: ' + (e?.message || e));
    }
  }

  async function onDelete(name: string) {
    const ok = confirm(`Delete ${name}? This will remove the file from data/pdfs.`);
    if (!ok) return;
    try {
      await deletePdf(name);
      alert('Deleted: ' + name + '. You should re-run Index PDFs to update embeddings.');
      await listPdfs();
    } catch (e) {
      alert(String(e));
    }
  }

  return (
    <section className="card p-4 mb-6">
      <h2 className="text-lg font-medium">Available PDFs</h2>
      <p className="text-sm text-zinc-600 mb-3">PDFs found in <code>data/pdfs</code>. Use this to confirm which files will be indexed.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <button onClick={() => listPdfs().catch(() => {})} className="px-3 py-2 rounded border">List PDFs</button>
        <button onClick={() => { /* refresh */ listPdfs().catch(() => {}); }} className="px-3 py-2 rounded border">Refresh</button>
        {pdfs && <div style={{ color: '#6b7280' }}>{pdfs.length} file(s)</div>}
      </div>

      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <label className="text-sm font-medium">Import PDF</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <input ref={fileInputRef} id="pdf-file-input" type="file" accept="application/pdf" style={{ display: 'none' }} />
          <label
            htmlFor="pdf-file-input"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: '#fffbeb',
              border: '1px solid #f59e0b',
              color: '#92400e',
              padding: '8px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Choose file
          </label>
          <span id="pdf-selected-name" style={{ color: '#6b7280', fontSize: 13 }}>{/* filename appears here */}</span>
          <button
            onClick={onImportClick}
            className="px-3 py-2 rounded border"
          >
            {uploadLoading ? 'Uploading…' : 'Import PDF'}
          </button>
          {uploadMsg && <div style={{ color: '#6b7280' }}>{uploadMsg}</div>}
        </div>
      </div>

      {pdfs && pdfs.length > 0 ? (
        <ul style={{ marginTop: 8 }}>
          {pdfs.map((p: any) => (
            <li key={p.name} style={{ padding: '6px 0', borderBottom: '1px solid #f1f1f1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 13 }} title={p.name}>{p.name}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{p.size !== null ? `${(p.size/1024).toFixed(1)} KB` : '—'} • {p.mtime ?? '—'}</div>
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                <button className="px-2 py-1 rounded border text-sm" onClick={() => { navigator.clipboard?.writeText(p.name); alert('Copied filename to clipboard'); }}>Copy name</button>
                <button className="px-2 py-1 rounded border text-sm" onClick={() => onDelete(p.name)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ color: '#6b7280', marginTop: 8 }}>No PDFs listed. Click "List PDFs".</div>
      )}
    </section>
  );
}
