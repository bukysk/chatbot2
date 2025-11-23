#!/usr/bin/env ts-node
/*
  Skript: index-pdfs.ts
  Účel: Načíta všetky PDF v data/pdfs, extrahuje text, rozdelí na chunky, vytvorí embeddings a uloží do data/subject_chunks.json.
  Spustenie: pnpm ts-node scripts/index-pdfs.ts (alebo npx ts-node ...)
*/
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';
// Import canonical settings from the shared config so tuning happens in one place.
// Use explicit extension to help Node+ts-node resolve the module in mixed ESM/CommonJS setups.
import { CHUNK_SIZE, CHUNK_OVERLAP, MIN_CHUNK_LENGTH, EMBEDDING_MODEL } from '../lib/config.ts';

const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');
const OUT_FILE = path.join(process.cwd(), 'data', 'subject_chunks.json');

interface ChunkRecord {
  id: string;
  file: string;
  text: string;
  embedding: number[];
}

function splitIntoChunks(text: string): string[] {
  // Pre-cleaning heuristics
  let cleaned = text.replace(/\r/g, '');
  // Remove hyphenation at line breaks: "exam-\nple" -> "example"
  cleaned = cleaned.replace(/-\n\s*/g, '');
  // Collapse single newlines into spaces (preserve double newlines as paragraph breaks)
  cleaned = cleaned.replace(/\n(?!\n)/g, ' ');
  // Remove repeated page headers/footers like "Page 2", "Strana 2 / 10"
  cleaned = cleaned.replace(/(^|\n)\s*(Page|Strana)\s*\d+(\s*\/\s*\d+)?\s*(\n|$)/gi, '\n');
  // Remove long runs of whitespace/tabs
  cleaned = cleaned.replace(/\t/g, ' ').replace(/ {2,}/g, ' ');

  // Remove lines that look like a table-of-contents entry before chunking
  const lines = cleaned.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const filteredLines: string[] = [];
  for (const l of lines) {
    // TOC-like: starts with digits and dots (e.g., "1.2. Topic") or very short enumerations
    if (/^\d+(\.\d+)*\s+/.test(l)) continue;
    // TOC-like: line is short and mostly numbers/roman numerals
    const short = l.length < 40 && /^[\divxIVX\.\s\-]*$/.test(l);
    if (short) continue;
    filteredLines.push(l);
  }
  cleaned = filteredLines.join('\n\n');

  const raw = cleaned.replace(/\n{2,}/g, '\n\n');
  const chunks: string[] = [];
  let index = 0;
  while (index < raw.length) {
    const end = Math.min(index + CHUNK_SIZE, raw.length);
    let chunk = raw.slice(index, end);
    // Prefer to split at a sentence boundary (., ?, !) if available within the chunk
    const lastSentenceEnd = Math.max(chunk.lastIndexOf('.'), chunk.lastIndexOf('?'), chunk.lastIndexOf('!'));
    let nextIndex: number;
    if (lastSentenceEnd > CHUNK_SIZE * 0.5 && end < raw.length) {
      // extend chunk to end of sentence
      chunk = chunk.slice(0, lastSentenceEnd + 1);
      nextIndex = index + (lastSentenceEnd + 1) - CHUNK_OVERLAP;
    } else {
      nextIndex = end - CHUNK_OVERLAP;
    }
    if (nextIndex <= index) nextIndex = end; // ensure progress
    index = nextIndex;
    chunks.push(chunk.trim());
  }

  // Merge very short chunks into previous chunk to avoid tiny fragments
  const merged: string[] = [];
  for (const c of chunks) {
    if (merged.length === 0) {
      merged.push(c);
      continue;
    }
    if (c.length < MIN_CHUNK_LENGTH) {
      // append to previous chunk with a space
      merged[merged.length - 1] = (merged[merged.length - 1] + ' ' + c).trim();
    } else {
      merged.push(c);
    }
  }
  return merged.filter(c => c.length > MIN_CHUNK_LENGTH);
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Chýba OPENAI_API_KEY');
    process.exit(1);
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const files = fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  if (files.length === 0) {
    console.error('Žiadne PDF v data/pdfs');
    process.exit(1);
  }
  const allChunks: ChunkRecord[] = [];
  for (const file of files) {
    const full = path.join(PDF_DIR, file);
    const buffer = fs.readFileSync(full);
    const parsed = await pdfParse(buffer);
    const chunks = splitIntoChunks(parsed.text);
    console.log(`Súbor: ${file} -> ${chunks.length} chunkov`);
    // Batch embeddings in chunks of 100 to avoid huge single requests
    const BATCH_SIZE = 100;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddingsResp = await client.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
      embeddingsResp.data.forEach((emb, j) => {
        allChunks.push({ id: `${file}#${i + j}`, file, text: batch[j], embedding: emb.embedding });
      });
    }
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify({ createdAt: new Date().toISOString(), chunks: allChunks }, null, 2));
  console.log(`Uložené embeddings -> ${OUT_FILE}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
