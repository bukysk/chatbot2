import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { EMBEDDING_MODEL, TOP_K_DEFAULT } from './config';
import runtimeConfig from './runtimeConfig';

const PDF_INDEX_VERBOSE = (process.env.PDF_INDEX_VERBOSE ?? 'false') === 'true';

export interface IndexedChunk { id: string; file: string; text: string; embedding: number[] }
interface IndexFile { createdAt: string; chunks: IndexedChunk[] }

let cachedIndex: IndexFile | null = null;
let cachedMtimeMs: number | null = null;

function indexFilePath() { return path.join(process.cwd(), 'data', 'subject_chunks.json'); }

function loadIndex(): IndexFile | null {
  const filePath = indexFilePath();
  if (!fs.existsSync(filePath)) return null;
  try {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;
    if (cachedIndex && cachedMtimeMs === mtime) return cachedIndex;
    const raw = fs.readFileSync(filePath, 'utf8');
    cachedIndex = JSON.parse(raw) as IndexFile;
    cachedMtimeMs = mtime;
    if (PDF_INDEX_VERBOSE) console.log(`[pdfIndex] loaded index: ${cachedIndex.chunks.length} chunks (createdAt=${cachedIndex.createdAt})`);
    return cachedIndex;
  } catch (err) {
    if (PDF_INDEX_VERBOSE) console.warn('[pdfIndex] failed to load index', err);
    return null;
  }
}

export function reloadIndex(): number | null {
  cachedIndex = null;
  cachedMtimeMs = null;
  const idx = loadIndex();
  return idx ? idx.chunks.length : null;
}

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type RetrievedChunk = { id: string; file: string; text: string; score: number };

// Lazy OpenAI client (reused)
let _openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const client = getOpenAIClient();
  if (!client) return null;
  const eff = runtimeConfig.getEffectiveConfig();
  const model = eff.EMBEDDING_MODEL || EMBEDDING_MODEL;
  const resp = await client.embeddings.create({ model, input: [query] });
  return resp.data[0].embedding as number[];
}

function scoreAll(queryEmb: number[], chunks: IndexedChunk[]) {
  return chunks.map(c => ({ c, score: cosine(queryEmb, c.embedding) }));
}

export async function retrieveSubjectContext(query: string, topK?: number): Promise<string[]> {
  if (!topK) topK = runtimeConfig.getEffectiveConfig().TOP_K ?? TOP_K_DEFAULT;
  const idx = loadIndex();
  if (!idx) return [];
  const queryEmb = await getQueryEmbedding(query);
  if (!queryEmb) { if (PDF_INDEX_VERBOSE) console.warn('[pdfIndex] OPENAI_API_KEY missing'); return []; }
  const scored = scoreAll(queryEmb, idx.chunks).sort((a, b) => b.score - a.score).slice(0, topK);
  if (PDF_INDEX_VERBOSE) console.log('[pdfIndex] retrieveSubjectContext top:', scored.map(s => ({ id: s.c.id, score: s.score })));
  return scored.map(s => s.c.text.trim());
}

export async function retrieveSubjectContextDetailed(query: string, topK?: number): Promise<RetrievedChunk[]> {
  if (!topK) topK = runtimeConfig.getEffectiveConfig().TOP_K ?? TOP_K_DEFAULT;
  const idx = loadIndex();
  if (!idx) return [];
  const queryEmb = await getQueryEmbedding(query);
  if (!queryEmb) { if (PDF_INDEX_VERBOSE) console.warn('[pdfIndex] OPENAI_API_KEY missing'); return []; }
  const scored = scoreAll(queryEmb, idx.chunks).sort((a, b) => b.score - a.score).slice(0, topK);
  if (PDF_INDEX_VERBOSE) console.log('[pdfIndex] retrieveSubjectContextDetailed top:', scored.map(s => ({ id: s.c.id, score: s.score })));
  return scored.map(s => ({ id: s.c.id, file: s.c.file, text: s.c.text.trim(), score: s.score }));
}

export async function retrieveRagChunks(query: string, topK = 5): Promise<RetrievedChunk[]> {
  const OVERFETCH_MULT = 3;
  const overfetch = Math.max(topK * OVERFETCH_MULT, topK + 5);
  const detailed = await retrieveSubjectContextDetailed(query, overfetch);
  if (!detailed || detailed.length === 0) return [];
  const filtered = detailed.filter(d => {
    const txt = String(d.text || '');
    const id = String(d.id || '');
    if (txt.startsWith('SUBJECT-LEVEL:')) return false;
    if (id.toLowerCase().includes('#subject')) return false;
    if (id.toLowerCase().includes('subject-level')) return false;
    return true;
  });
  return filtered.slice(0, topK);
}

export async function retrieveCentroidChunks(topK?: number): Promise<RetrievedChunk[]> {
  if (!topK) topK = runtimeConfig.getEffectiveConfig().TOP_K ?? TOP_K_DEFAULT;
  const idx = loadIndex();
  if (!idx) return [];
  const dim = idx.chunks[0]?.embedding?.length ?? 0;
  const centroid = new Array<number>(dim).fill(0);
  for (const c of idx.chunks) for (let i = 0; i < dim; i++) centroid[i] += (c.embedding[i] || 0);
  for (let i = 0; i < dim; i++) centroid[i] /= Math.max(1, idx.chunks.length);
  const scored = idx.chunks.map(c => ({ c, score: cosine(centroid, c.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => ({ id: s.c.id, file: s.c.file, text: s.c.text.trim(), score: s.score }));
}

export async function retrieveHybridContext(query: string, centroidTop = 5, queryTop = 10): Promise<RetrievedChunk[]> {
  const idx = loadIndex();
  if (!idx) return [];
  const queryEmb = await getQueryEmbedding(query);
  if (!queryEmb) { if (PDF_INDEX_VERBOSE) console.warn('[pdfIndex] OPENAI_API_KEY missing'); return []; }
  // centroid
  const dim = idx.chunks[0]?.embedding?.length || queryEmb.length;
  const centroid = new Array<number>(dim).fill(0);
  for (const c of idx.chunks) for (let i = 0; i < dim; i++) centroid[i] += (c.embedding[i] || 0);
  for (let i = 0; i < dim; i++) centroid[i] /= Math.max(1, idx.chunks.length);

  const scoredByCentroid = idx.chunks.map(c => ({ id: c.id, score: cosine(centroid, c.embedding) }));
  scoredByCentroid.sort((a, b) => b.score - a.score);
  const topCentroid = scoredByCentroid.slice(0, centroidTop).map(s => s.id);

  const scoredByQuery = idx.chunks.map(c => ({ id: c.id, score: cosine(queryEmb, c.embedding) }));
  scoredByQuery.sort((a, b) => b.score - a.score);
  const topQuery = scoredByQuery.slice(0, queryTop).map(s => s.id);

  const idSet = new Set<string>([...topCentroid, ...topQuery]);
  const union = Array.from(idSet);
  const final = union.map(id => {
    const c = idx.chunks.find(ch => ch.id === id)!;
    return { id: c.id, file: c.file, text: c.text.trim(), score: cosine(queryEmb, c.embedding) };
  }).sort((a, b) => b.score - a.score);

  if (PDF_INDEX_VERBOSE) {
    console.log('[pdfIndex] hybrid top-centroid ids:', topCentroid);
    console.log('[pdfIndex] hybrid top-query ids:', topQuery.slice(0, 10));
    console.log('[pdfIndex] hybrid final ids:', final.map(f => ({ id: f.id, score: f.score })));
  }

  return final;
}
