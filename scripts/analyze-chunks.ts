#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';

interface IndexedChunk { id: string; file: string; text: string; embedding: number[]; }

const FILE = path.join(process.cwd(), 'data', 'subject_chunks.json');
if (!fs.existsSync(FILE)) {
  console.error('Index file not found:', FILE);
  process.exit(1);
}

const raw = fs.readFileSync(FILE, 'utf8');
const parsed = JSON.parse(raw) as { createdAt: string; chunks: IndexedChunk[] };
const chunks = parsed.chunks || [];

function median(values: number[]) {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

const lengths = chunks.map(c => c.text.length);
const lineCounts = chunks.map(c => (c.text.match(/\n/g) || []).length + 1);

console.log('Index createdAt:', parsed.createdAt);
console.log('Total chunks:', chunks.length);
if (chunks.length === 0) process.exit(0);

console.log('Length stats (chars): min=%d median=%d avg=%d max=%d',
  Math.min(...lengths), median(lengths), Math.round(lengths.reduce((a,b)=>a+b,0)/lengths.length), Math.max(...lengths));

console.log('Line breaks per chunk: min=%d median=%d avg=%d max=%d',
  Math.min(...lineCounts), median(lineCounts), Math.round(lineCounts.reduce((a,b)=>a+b,0)/lineCounts.length), Math.max(...lineCounts));

// Find chunks that look like TOC or header-heavy: many short lines
const headerLike = chunks.filter(c => {
  const lines = c.text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return false;
  const shortLineRatio = lines.filter(l => l.length < 40).length / lines.length;
  return shortLineRatio > 0.6;
});

console.log('Chunks with many short lines (likely TOC/headers):', headerLike.length);

// Sample outputs: show a few shortest and longest chunks for inspection
const sortedByLen = chunks.slice().sort((a,b) => a.text.length - b.text.length);
const sampleShort = sortedByLen.slice(0, 5);
const sampleLong = sortedByLen.slice(-5).reverse();

console.log('\n--- Shortest chunks ---');
sampleShort.forEach(c => {
  console.log(`ID: ${c.id} | file: ${c.file} | len: ${c.text.length} | lines: ${(c.text.match(/\n/g)||[]).length + 1}`);
  console.log('---');
  console.log(c.text.slice(0, 800).replace(/\n/g, '\\n'));
  console.log('\n');
});

console.log('\n--- Longest chunks ---');
sampleLong.forEach(c => {
  console.log(`ID: ${c.id} | file: ${c.file} | len: ${c.text.length} | lines: ${(c.text.match(/\n/g)||[]).length + 1}`);
  console.log('---');
  console.log(c.text.slice(0, 800).replace(/\n/g, '\\n'));
  console.log('\n');
});

console.log('\nTip: if many chunks look like TOC/headers, patch `scripts/index-pdfs.ts` to clean headers/footers and collapse short lines before chunking.');
