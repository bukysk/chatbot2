import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';
import { CHUNK_SIZE, CHUNK_OVERLAP, MIN_CHUNK_LENGTH, EMBEDDING_MODEL } from './config';

interface ChunkRecord {
  id: string;
  file: string;
  text: string;
  embedding: number[];
}

function splitIntoChunks(text: string): string[] {
  let cleaned = text.replace(/\r/g, '');
  cleaned = cleaned.replace(/-\n\s*/g, '');
  cleaned = cleaned.replace(/\n(?!\n)/g, ' ');
  cleaned = cleaned.replace(/(^|\n)\s*(Page|Strana)\s*\d+(\s*\/\s*\d+)?\s*(\n|$)/gi, '\n');
  cleaned = cleaned.replace(/\t/g, ' ').replace(/ {2,}/g, ' ');

  const lines = cleaned.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const filteredLines: string[] = [];
  for (const l of lines) {
    if (/^\d+(\.\d+)*\s+/.test(l)) continue;
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
    const lastSentenceEnd = Math.max(chunk.lastIndexOf('.'), chunk.lastIndexOf('?'), chunk.lastIndexOf('!'));
    let nextIndex: number;
    if (lastSentenceEnd > CHUNK_SIZE * 0.5 && end < raw.length) {
      chunk = chunk.slice(0, lastSentenceEnd + 1);
      nextIndex = index + (lastSentenceEnd + 1) - CHUNK_OVERLAP;
    } else {
      nextIndex = end - CHUNK_OVERLAP;
    }
    if (nextIndex <= index) nextIndex = end;
    index = nextIndex;
    chunks.push(chunk.trim());
  }

  const merged: string[] = [];
  for (const c of chunks) {
    if (merged.length === 0) {
      merged.push(c);
      continue;
    }
    if (c.length < MIN_CHUNK_LENGTH) {
      merged[merged.length - 1] = (merged[merged.length - 1] + ' ' + c).trim();
    } else {
      merged.push(c);
    }
  }
  return merged.filter(c => c.length > MIN_CHUNK_LENGTH);
}

export async function runIndexer(opts?: { pdfDir?: string; outFile?: string; batchSize?: number }): Promise<{ chunks: number; outFile: string }> {
  const PDF_DIR = opts?.pdfDir || path.join(process.cwd(), 'data', 'pdfs');
  const OUT_FILE = opts?.outFile || path.join(process.cwd(), 'data', 'subject_chunks.json');
  const BATCH_SIZE = opts?.batchSize || 100;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const files = fs.existsSync(PDF_DIR) ? fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf')) : [];
  if (files.length === 0) {
    throw new Error(`No PDF files found in ${PDF_DIR}`);
  }

  const allChunks: ChunkRecord[] = [];
  for (const file of files) {
    const full = path.join(PDF_DIR, file);
    const buffer = fs.readFileSync(full);
    const parsed = await pdfParse(buffer);
    const chunks = splitIntoChunks(parsed.text || '');
    // batch embeddings
    const fileChunkRecords: ChunkRecord[] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddingsResp = await client.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
      embeddingsResp.data.forEach((emb, j) => {
        const rec: ChunkRecord = { id: `${file}#${i + j}`, file, text: batch[j], embedding: emb.embedding };
        allChunks.push(rec);
        fileChunkRecords.push(rec);
      });
    }

    if (fileChunkRecords.length > 0) {
      const dim = fileChunkRecords[0].embedding.length;
      const sum = new Array<number>(dim).fill(0);
      for (const c of fileChunkRecords) {
        for (let k = 0; k < dim; k++) sum[k] += c.embedding[k];
      }
      const avg = sum.map(v => v / fileChunkRecords.length);
      const subjectText = `SUBJECT-LEVEL: ${file} (centroid of ${fileChunkRecords.length} chunks)`;
      const subjectRec: ChunkRecord = { id: `${file}#subject`, file, text: subjectText, embedding: avg };
      allChunks.push(subjectRec);
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify({ createdAt: new Date().toISOString(), chunks: allChunks }, null, 2));
  return { chunks: allChunks.length, outFile: OUT_FILE };
}

export default runIndexer;
