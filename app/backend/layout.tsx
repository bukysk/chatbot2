"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

export default function BackendLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/backend';

  const items: NavItem[] = [
    { href: '/backend', label: 'Overview' },
    { href: '/backend/sessions', label: 'Sessions' },
    { href: '/backend/retrieval', label: 'Retrieval' },
    { href: '/backend/runtime', label: 'Runtime' },
    { href: '/backend/pdfs', label: 'PDFs' },
    { href: '/backend/indexing', label: 'Indexing' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 240, background: '#0f172a', color: '#fff', padding: 20 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Backend</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it) => {
            const active = pathname === it.href || (it.href !== '/backend' && pathname?.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                style={{
                  display: 'block',
                  padding: '8px 10px',
                  borderRadius: 8,
                  color: active ? '#0f172a' : '#e6eef8',
                  background: active ? '#e6eef8' : 'transparent',
                  textDecoration: 'none',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 24, background: '#f8fafc' }}>
        {children}
      </main>
    </div>
  );
}
