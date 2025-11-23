import fs from 'fs';
import path from 'path';
import readline from 'readline';
import OpenAI from 'openai';
// Use explicit extension so ts-node / Node ESM resolution matches other scripts
import { EMBEDDING_MODEL, TOP_K_DEFAULT } from '../lib/config.ts';

// Load local env if present
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function askQueryFromStdin(promptText: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>(resolve => rl.question(promptText, ans => { rl.close(); resolve(ans); }));
}

async function main() {
  const args = process.argv.slice(2);
  let topK = TOP_K_DEFAULT;
  let query = args.join(' ').trim();

  // support optional flag --top=NUM
  const topArg = args.find(a => a.startsWith('--top='));
  if (topArg) {
    const num = parseInt(topArg.split('=')[1] || '', 10);
    if (!isNaN(num) && num > 0) topK = num;
    // remove from query
    query = args.filter(a => !a.startsWith('--top=')).join(' ').trim();
  }

  if (!query) {
    query = await askQueryFromStdin('Enter query to retrieve chunks for: ');
  }

  if (!query) {
    console.error('No query provided. Exiting.');
    process.exit(1);
  }

  const indexPath = path.join(process.cwd(), 'data', 'subject_chunks.json');
  if (!fs.existsSync(indexPath)) {
    console.error(`Index file not found: ${indexPath}`);
    console.error('Run the indexer first: node --max-old-space-size=4096 -r ts-node/register "scripts/index-pdfs.ts"');
    process.exit(1);
  }

  const raw = fs.readFileSync(indexPath, 'utf8');
  const idx = JSON.parse(raw) as { createdAt: string; chunks: Array<{ id: string; file: string; text: string; embedding: number[] }> };

  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in environment. Set it in .env.local and re-run.');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log(`Computing embedding for query (model=${EMBEDDING_MODEL})...`);
  const embResp = await client.embeddings.create({ model: EMBEDDING_MODEL, input: [query] });
  const queryEmb = embResp.data[0].embedding;

  const scored = idx.chunks.map(c => ({ id: c.id, file: c.file, text: c.text, score: cosine(queryEmb, c.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);

  console.log(`\nIndex createdAt: ${idx.createdAt}`);
  console.log(`Query: ${query}`);
  console.log(`Top ${top.length} chunks:`);
  for (let i = 0; i < top.length; i++) {
    const t = top[i];
    console.log('------------------------------------------------------------');
    console.log(`#${i + 1} id: ${t.id}`);
    console.log(`file: ${t.file}`);
    console.log(`score: ${t.score.toFixed(4)}`);
    const excerpt = t.text.replace(/\s+/g, ' ').trim().slice(0, 600);
    console.log(`excerpt: ${excerpt}${t.text.length > 600 ? '...' : ''}`);
  }
  console.log('------------------------------------------------------------');
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
