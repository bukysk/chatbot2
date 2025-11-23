import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { EMBEDDING_MODEL, TOP_K_DEFAULT } from './config';

export interface IndexedChunk { id: string; file: string; text: string; embedding: number[]; }
interface IndexFile { createdAt: string; chunks: IndexedChunk[]; }

let cachedIndex: IndexFile | null = null;

function loadIndex(): IndexFile | null {
  if (cachedIndex) return cachedIndex;
  const filePath = path.join(process.cwd(), 'data', 'subject_chunks.json');
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  cachedIndex = JSON.parse(raw) as IndexFile;
  console.log(`[pdfIndex] Načítaný index: ${cachedIndex.chunks.length} chunkov (createdAt=${cachedIndex.createdAt})`);
  return cachedIndex;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function retrieveSubjectContext(query: string, topK = TOP_K_DEFAULT): Promise<string[]> {
  const idx = loadIndex();
  if (!idx) return [];
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[pdfIndex] OPENAI_API_KEY missing; cannot compute query embedding.');
    return [];
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embResp = await client.embeddings.create({ model: EMBEDDING_MODEL, input: [query] });
  const queryEmbedding = embResp.data[0].embedding;
  const scored = idx.chunks.map(c => ({ c, score: cosine(queryEmbedding, c.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);
  // Diagnostic logging to help tune retrieval
  try {
    console.log('[pdfIndex] query:', query.length > 200 ? query.slice(0, 200) + '...' : query);
    console.log('[pdfIndex] top-k:', top.map(s => ({ id: s.c.id, file: s.c.file, score: s.score })));
  } catch (e) {
    // ignore logging errors
  }
  return top.map(s => s.c.text.trim());
}
