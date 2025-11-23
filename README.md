This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Chatbot Usage

This project now includes a streaming ChatGPT-like interface powered by the OpenAI API.

### 1. Set Your API Key

Create (or edit) `.env.local` and set:

```bash
OPENAI_API_KEY=sk-...
```

Restart dev server after changing env variables.

### 2. Run Development Server

```bash
pnpm dev
# or npm run dev / yarn dev
```

Open http://localhost:3000 — the root page is the chat UI.

### Questionnaire Flow (Thesis Recommendation)

The landing page now shows a questionnaire for FHI (Fakulta Hospodárskej informatiky) students. After submitting:
- The app builds a structured system prompt containing the anonymized profile.
- Automatically triggers an initial request recommending 3–5 thesis topics (with descriptions, methods, rationale, risks).
- The chat continues allowing follow-up refinement (e.g., "rozviň tému 2" or "navrhni variant pre AI").

Questions captured: prior study, experienced areas (limit 3), strengths, weaknesses, interest areas (limit 3), preferred topic type, practice linkage, optional supervisor, one-sentence ideal topic.

To adapt rules (format, number of topics) edit `buildSystemPrompt()` inside `app/page.tsx`.

### Adding Subject Info PDFs (Context Retrieval)

You can enrich recommendations with official subject information PDFs (e.g., course syllabi, info sheets). The system will pull the most relevant chunks and append them to the system prompt.

1. Place your PDF files (max a few MB total) in:
	`data/pdfs/`

2. Index them to create embeddings (ensure ts-node installed, already added in devDependencies):
```bash
pnpm ts-node scripts/index-pdfs.ts
```
This produces `data/subject_chunks.json` containing chunk text + embeddings.

3. Start the dev server (if not already):
```bash
pnpm dev
```

4. On first questionnaire submission, the API route (`app/api/chat/route.ts`) will:
	- Take the last user message or the initial prompt.
	- Retrieve top 3 similar chunks (vector similarity cosine).
	- Append them under "Doplňujúci kontext z informačných listov predmetov" inside the system prompt.

5. To tweak retrieval:
	- Change `topK` in `retrieveSubjectContext(query, 3)` (file `lib/pdfIndex.ts`).
	- Adjust chunk size / overlap in `scripts/index-pdfs.ts` (`CHUNK_SIZE`, `CHUNK_OVERLAP`).
	- Swap embedding model (e.g. `text-embedding-3-large`).

6. Re-index whenever PDFs change:
```bash
pnpm ts-node scripts/index-pdfs.ts
```

7. If no `subject_chunks.json` is present, the chatbot silently skips enrichment.

8. For production: run the indexing step in build pipeline or pre-generate the JSON and commit it (if allowed), or store embeddings in a vector DB (Pinecone, PgVector, etc.).

Security note: Keep PDFs out of `public/` if they contain internal data; current path is server-side only.

### 3. Using the Chat UI

- System prompt text area at the top lets you define behavior (instructions in Slovak or any language).
- Type a message and press Enter or click Odoslať.
- Responses stream token-by-token for a smoother experience.
- Click "Vyčistiť chat" to reset conversation.

### 4. Where the Logic Lives

- Frontend: `app/page.tsx`
- API route: `app/api/chat/route.ts` (streams OpenAI response)

### 5. Changing the Model / Parameters

Edit `app/api/chat/route.ts` and adjust:

```ts
model: "gpt-4o-mini",
temperature: 0.7,
```

### 6. Deployment Notes

- Ensure `OPENAI_API_KEY` is added to hosting provider environment variables.
- Streaming uses a readable stream; supported on most modern platforms (Vercel, etc.).

### 7. Troubleshooting

- 500 Missing OPENAI_API_KEY: set env var and restart.
# Chatbot2 — Next.js + OpenAI PDF-backed assistant

This repository is a Next.js app that provides a streaming chat UI backed by OpenAI. The assistant can use pre-indexed PDF course materials (embeddings) to answer or recommend thesis topics without hallucinating.

This README documents the current project layout, how to run it locally, how to index PDFs, and how to tune retrieval.

## Quick start

1. Install dependencies (use your preferred package manager):

```powershell
npm install
# or: pnpm install
```

2. Create `.env.local` with your OpenAI key and optional overrides (see config section below):

```text
OPENAI_API_KEY=sk-...
# Optional tuning overrides (examples):
# EMBEDDING_MODEL=text-embedding-3-large
# CHAT_MODEL=gpt-4o-mini
# CHUNK_SIZE=1400
# CHUNK_OVERLAP=150
# MIN_CHUNK_LENGTH=60
# TOP_K=3
```

3. Run the dev server:

```powershell
npm run dev
```

Open http://localhost:3000 — the root page is the chat UI.

## Project files of interest

- `app/page.tsx` — frontend UI and streaming client logic.
- `app/api/chat/route.ts` — server-side streaming API route that builds the system prompt and calls OpenAI.
- `lib/config.ts` — canonical configuration (chunking, embedding model, prompt template). Edit env vars or this file for defaults.
- `lib/pdfIndex.ts` — loads `data/subject_chunks.json`, computes query embeddings, and returns top-K chunks.
- `scripts/index-pdfs.ts` — PDF indexer: extracts text, cleans & chunks it, creates embeddings, and writes `data/subject_chunks.json`.
- `data/pdfs/` — drop your PDF files here for indexing (server-side only).
- `data/subject_chunks.json` — generated index (chunk text + embeddings).

## Indexing PDFs (create/update embeddings)

Place PDFs into `data/pdfs/` and run the indexer. The indexer cleans text, prefers sentence boundaries, merges tiny fragments, and batches embedding requests.

Recommended command (use more heap for large PDFs):

```powershell
# from repo root
node --max-old-space-size=4096 -r ts-node/register "scripts/index-pdfs.ts"
```

After success you should see `Uložené embeddings -> data/subject_chunks.json` and per-file chunk counts.

Re-run the indexer whenever you add/remove PDFs or change `EMBEDDING_MODEL`.

## Configuration and tuning

All runtime defaults live in `lib/config.ts` and are overridable via `.env.local`.

- Embeddings: `EMBEDDING_MODEL` (defaults to `text-embedding-3-small`; use `text-embedding-3-large` for higher accuracy — re-index required).
- Chat model: `CHAT_MODEL` (defaults in `lib/config.ts` — change if you need different latency/capability).
- Chunking: `CHUNK_SIZE`, `CHUNK_OVERLAP`, `MIN_CHUNK_LENGTH` — tune these to control chunk granularity. Defaults tuned for PDFs but adjust to your documents.
- Retrieval: `TOP_K` controls how many chunks are appended to the system prompt.
- Prompt template: `PROMPT_TEMPLATE` in `lib/config.ts` contains the system prompt used for thesis recommendations; you can override with an env var but editing the file is easier for big template changes.

Example `.env.local` snippet:

```text
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-large
CHAT_MODEL=gpt-4o-mini
CHUNK_SIZE=1800
CHUNK_OVERLAP=200
MIN_CHUNK_LENGTH=120
TOP_K=3
CHAT_TEMPERATURE=0.0
```

Notes:
- Changing `EMBEDDING_MODEL` requires re-running the indexer.
- Lower `CHAT_TEMPERATURE` (0.0–0.3) reduces hallucination.

## Diagnosing and improving chunking/retrieval

Tools and tips included in the repo:

- `scripts/analyze-chunks.ts` — prints chunk length stats and samples to help spot TOC or header-heavy chunks. Run with:
```powershell
npx ts-node "scripts/analyze-chunks.ts"
```
- `lib/pdfIndex.ts` now logs top-K retrieved chunk ids and scores for each query — watch Next server logs when you submit queries.

Common fixes:
- If many tiny or TOC-like chunks exist: increase `CHUNK_SIZE`, increase `MIN_CHUNK_LENGTH`, or enable additional cleaning in `scripts/index-pdfs.ts` (the script already strips simple TOC/footer patterns).
- If retrieval misses facts: try `text-embedding-3-large` (re-index) and/or increase `TOP_K`.

Quantitative approach:
- Create a small QA set and test recall@K (not included by default). Use `scripts/analyze-chunks.ts` and a simple QA script to compare settings and embedding models.

## Running locally (common commands)

```powershell
# Install
npm install

# Index PDFs (rebuild embeddings)
node --max-old-space-size=4096 -r ts-node/register "scripts/index-pdfs.ts"

# Analyze chunks
npx ts-node "scripts/analyze-chunks.ts"

# Run dev server
npm run dev
```

## Troubleshooting

- `Missing OPENAI_API_KEY` or 500 errors: ensure `OPENAI_API_KEY` is set in `.env.local` and restart the dev server.
- `Cannot find module 'dotenv/config'`: install `dotenv` with `npm install dotenv` (the indexer now imports `dotenv/config` itself).
- Indexer OOM: increase `--max-old-space-size` or split large PDFs.
- If the assistant replies "Nemám dostatočné informácie...": retrieval returned no supporting chunks — inspect logs and analyzer output, then re-index or increase `TOP_K`.

## Production notes

- Pre-generate `data/subject_chunks.json` during your build pipeline, or store embeddings in a managed vector DB for scale.
- Keep `OPENAI_API_KEY` in your hosting provider's secrets (do NOT commit `.env.local`).

## Where to look next

- To change assistant behavior: edit `lib/config.ts` → `PROMPT_TEMPLATE`.
- To tweak chunking: edit `lib/config.ts` or `.env.local` and re-run the indexer.
- To inspect retrieval: check Next server logs (look for `[pdfIndex] top-k:` messages).

---

If you want, I can add a short `scripts/qa-eval.ts` to measure recall@K across settings — say the word and I'll scaffold it.
