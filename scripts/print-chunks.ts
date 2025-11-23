#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';

const INDEX_FILE = path.join(process.cwd(), 'data', 'subject_chunks.json');

function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) throw new Error('Index file not found: ' + INDEX_FILE);
  const raw = fs.readFileSync(INDEX_FILE, 'utf8');
  return JSON.parse(raw || '{}');
}

function printChunk(c: any) {
  console.log('---', c.id, '---');
  if (c.file) console.log('file:', c.file);
  if (c.score !== undefined) console.log('score:', c.score);
  console.log(c.text || '');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: ts-node scripts/print-chunks.ts <chunkId> [more ids...]');
    process.exit(2);
  }
  const idx = loadIndex();
  const map: Record<string, any> = {};
  for (const c of idx.chunks || []) map[c.id] = c;
  for (const id of args) {
    const c = map[id];
    if (!c) console.error('NOT FOUND:', id);
    else printChunk(c);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
