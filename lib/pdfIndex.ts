import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

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

export async function retrieveSubjectContext(query: string, topK = 3): Promise<string[]> {
  const idx = loadIndex();
  if (!idx) return [];
  if (!process.env.OPENAI_API_KEY) return [];
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embResp = await client.embeddings.create({ model: 'text-embedding-3-small', input: [query] });
  const queryEmbedding = embResp.data[0].embedding;
  const scored = idx.chunks.map(c => ({ c, score: cosine(queryEmbedding, c.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.c.text.trim());
}
