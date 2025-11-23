#!/usr/bin/env ts-node
/*
  Skript: index-pdfs.ts
  Účel: Načíta všetky PDF v data/pdfs, extrahuje text, rozdelí na chunky, vytvorí embeddings a uloží do data/subject_chunks.json.
  Spustenie: pnpm ts-node scripts/index-pdfs.ts (alebo npx ts-node ...)
*/
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';

const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');
const OUT_FILE = path.join(process.cwd(), 'data', 'subject_chunks.json');
const CHUNK_SIZE = 1400; // približne ~300 tokenov
const CHUNK_OVERLAP = 150;

interface ChunkRecord {
  id: string;
  file: string;
  text: string;
  embedding: number[];
}

function splitIntoChunks(text: string): string[] {
  const cleaned = text.replace(/\r/g, '').replace(/\t/g, ' ').replace(/ +/g, ' ');
  const chunks: string[] = [];
  let index = 0;
  while (index < cleaned.length) {
    const end = Math.min(index + CHUNK_SIZE, cleaned.length);
    let chunk = cleaned.slice(index, end);
    // Rozšíriť do najbližšej bodky pre prirodzenejší koniec
    const lastPeriod = chunk.lastIndexOf('.');
    if (lastPeriod > CHUNK_SIZE * 0.6 && end < cleaned.length) {
      chunk = chunk.slice(0, lastPeriod + 1);
      index += lastPeriod + 1 - CHUNK_OVERLAP;
    } else {
      index = end - CHUNK_OVERLAP;
    }
    chunks.push(chunk.trim());
  }
  return chunks.filter(c => c.length > 60); // odstráni veľmi krátke
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
    // Batch embeddings
    const embeddingsResp = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunks
    });
    embeddingsResp.data.forEach((emb, i) => {
      allChunks.push({
        id: `${file}#${i}`,
        file,
        text: chunks[i],
        embedding: emb.embedding
      });
    });
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify({ createdAt: new Date().toISOString(), chunks: allChunks }, null, 2));
  console.log(`Uložené embeddings -> ${OUT_FILE}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
