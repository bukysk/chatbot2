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
# Chatbot2 — Next.js + OpenAI PDF-backed assistant

This repository is a developer-focused Next.js application that provides a streaming chat UI backed by OpenAI. It can enrich responses with context extracted from indexed PDF files (course sheets, syllabi, etc.).

This README replaces prior notes and explains how to set up, run, and use the app — including the backend developer tools and debug endpoints.

--

## Key features
- Streaming chat API powered by OpenAI.
- Local PDF indexing pipeline that extracts text, chunks it, and creates embeddings written to `data/subject_chunks.json`.
- Multiple retrieval strategies (query-only, RAG excluding subject-level centroids, centroid, hybrid).
- Developer backend UI (`/backend`) with: index rebuild, ad-hoc retrieval, session inspection, import/delete PDFs, and runtime config overrides.

## Requirements
- Node.js 18+ and npm/pnpm/yarn
- A valid OpenAI API key for embeddings and chat usage
- Recommended: `pnpm` for package management (works with npm/yarn too)

## Quick setup

1. Clone repository and open the project root.

2. Install dependencies:

```powershell
pnpm install
# or: npm install
```

3. Add environment variables in `.env.local` (create file in repo root):

```text
OPENAI_API_KEY=sk-...
# Optional dev-only guard for debug endpoints
DEV_DEBUG_SECRET=some-secret
```

4. Start the dev server:

```powershell
pnpm dev
```

Open http://localhost:3000 — the front page is the chat UI. The backend developer UI is at http://localhost:3000/backend.

## Indexing PDFs

Place your PDF files in `data/pdfs/`. The indexer extracts text, chunks into passages, and writes embeddings to `data/subject_chunks.json`.

- To rebuild the index (recommended): use the backend UI button (Backend → Index PDFs) or call the rebuild endpoint:

```powershell
# POST to rebuild (use x-dev-secret header if you set DEV_DEBUG_SECRET)
curl -X POST http://localhost:3000/api/debug/rebuild-index -H "x-dev-secret: your-secret"
```

Notes:
- Rebuild runs the indexer in-process and regenerates embeddings (this calls OpenAI and can be slow/costly).
- After changing `EMBEDDING_MODEL` or chunking params, you must rebuild.

## Backend / Dev Tools (UI at `/backend`)

The backend page provides developer controls. Buttons and features:

- List sessions: fetches retrieval debug sessions recorded by the chat route.
- Fetch selected session: shows retrieval records and the chunk texts used for that session.
- Ad-hoc Retrieval: run retrievals in different modes (`rag`, `hybrid`, `centroid`, `detailed`) against the current in-memory index.
- Index PDFs / Indexing: triggers `POST /api/debug/rebuild-index` which regenerates embeddings and reloads the running index.
- Available PDFs: lists files in `data/pdfs` and provides:
  - Import PDF: upload a PDF (the endpoint saves to `data/pdfs`).
  - Delete: removes the PDF file from `data/pdfs` (guarded by `DEV_DEBUG_SECRET` when set). Deleting does NOT automatically rebuild the index — press "Index PDFs" afterwards.
- Runtime Config (new): load and edit runtime overrides (embedding model, TOP_K, chat temperature, chunking hints). Overrides live in `data/local_config.json` and affect retrieval and chat defaults immediately (but changing embedding model requires a rebuild to regenerate embeddings).

## Debug endpoints (development only)

Common endpoints (all under `/api/debug`):

- `POST /api/debug/rebuild-index` — rebuilds embeddings and reloads in-memory index. Guarded by `DEV_DEBUG_SECRET` when set.
- `POST /api/debug/used-chunks` and `GET /api/debug/used-chunks?q=...` — ad-hoc retrieval; returns chunk ids, files, scores and excerpts.
- `GET /api/debug/sessions` — lists recorded retrieval sessions.
- `GET /api/debug/session/:id?includeTexts=1` — returns retrieval records for a session; `includeTexts=1` enriches entries with chunk text from the index.
- `POST /api/debug/import-pdf` — upload a base64 PDF into `data/pdfs` (guarded by `DEV_DEBUG_SECRET`).
- `POST /api/debug/delete-pdf` — delete a PDF file from `data/pdfs` (guarded by `DEV_DEBUG_SECRET`).
- `POST/GET /api/debug/runtime-config` — read or update runtime overrides saved to `data/local_config.json` (POST guarded by `DEV_DEBUG_SECRET`).
- `POST/GET /api/debug/chunk` — fetch a single chunk by id from the index file.

Security: These endpoints are intended for local development only. If you expose them externally, use `DEV_DEBUG_SECRET` and secure your environment.

## Where runtime settings live

- Defaults are in `lib/config.ts` (CHUNK_SIZE, CHUNK_OVERLAP, EMBEDDING_MODEL, TOP_K, CHAT_TEMPERATURE, etc.).
- You can override selected values at runtime via the Backend → Runtime Config panel; overrides are saved to `data/local_config.json` and consumed by `lib/pdfIndex.ts` and `app/api/chat/route.ts` for embedding model, TOP_K defaults, and chat temperature.

Important: changing chunking settings or embedding model in overrides will require running the rebuild to regenerate `subject_chunks.json` for those changes to take effect.

## Data files

- `data/pdfs/` — uploaded PDF files (server-side only).
- `data/subject_chunks.json` — single-file index of chunks and embeddings (canonical source for retrieval).
- `data/retrieval_debug.json` — file-backed retrieval store used to persist debug sessions across dev workers.
- `data/local_config.json` — runtime overrides set via backend UI.

## Notes & troubleshooting

- Missing `OPENAI_API_KEY` will cause embedding and chat calls to fail: set the env var and restart.
- Rebuild can be slow for many PDFs — watch server logs for progress.
- If retrieval returns no hits, inspect `data/subject_chunks.json` and run `scripts/analyze-chunks.ts` (archived scripts are in `archive/legacy-scripts/`).

## Removing legacy scripts

Old CLI scripts were archived under `archive/legacy-scripts/` to reduce repo noise. You can restore them or use the backend endpoints instead.

## Development tips

- Use `DEV_DEBUG_SECRET` to protect destructive or admin operations when working on shared dev machines.
- Prefer `rebuild-index` to regenerate embeddings; do not edit `data/subject_chunks.json` manually unless you know the format.

--

If you want, I can also:
- Add a short QA script to measure recall@K.
- Make delete-PDF optionally trigger an automatic rebuild (checkbox in the UI).
- Run `pnpm exec tsc --noEmit` and start the dev server to smoke-test the new backend features.

Tell me which of these you'd like next.
# Optional tuning overrides (examples):
