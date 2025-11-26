"use client";

import { useState } from 'react';

export default function usePdfs(initialFiles?: any[]) {
  const [pdfs, setPdfs] = useState<any[] | null>(initialFiles ?? null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  async function listPdfs() {
    try {
      const res = await fetch('/api/debug/list-pdfs');
      if (!res.ok) throw new Error('Failed to list PDFs');
      const j = await res.json();
      setPdfs(j.files || []);
      return j.files || [];
    } catch (e) {
      throw e;
    }
  }

  async function importPdf(file: File) {
    setUploadLoading(true);
    setUploadMsg(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(new Error('Failed to read file'));
        fr.onload = () => resolve(String(fr.result || ''));
        fr.readAsDataURL(file);
      });
      const secret = window.prompt('Enter DEV_DEBUG_SECRET (leave empty if none)');
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (secret) headers['x-dev-secret'] = secret;
      const res = await fetch('/api/debug/import-pdf', { method: 'POST', headers, body: JSON.stringify({ name: file.name, content: dataUrl }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || j?.message || 'Upload failed');
      setUploadMsg(`Uploaded ${j.name}`);
      await listPdfs();
      return j;
    } finally {
      setUploadLoading(false);
    }
  }

  async function deletePdf(name: string) {
    try {
      const secret = window.prompt('Enter DEV_DEBUG_SECRET (leave empty if none)');
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (secret) headers['x-dev-secret'] = secret;
      const res = await fetch('/api/debug/delete-pdf', { method: 'POST', headers, body: JSON.stringify({ name }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || j?.message || 'Delete failed');
      await listPdfs();
      return j;
    } catch (e) {
      throw e;
    }
  }

  return { pdfs, listPdfs, importPdf, deletePdf, uploadLoading, uploadMsg } as const;
}
