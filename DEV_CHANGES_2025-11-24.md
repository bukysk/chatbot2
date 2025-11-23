Development changes added on 2025-11-24
=====================================

Summary
-------
This document lists all developer-facing changes made in the session so you can pick up work tomorrow. The goal: make PDF-chunk retrieval transparent, rebuildable, and visible for live chat traffic.

Files added / updated
---------------------
- `app/api/debug/chunk/route.ts`
  - GET `?id=...` and POST `{ id }` to return a single chunk record (id, file, text, score when available).
  - Example: `GET /api/debug/chunk?id=predmet1.pdf#63`.

- `app/api/debug/rebuild-index/route.ts`
  - POST to run the TypeScript indexer (`scripts/index-pdfs.ts`) from the server and then call `reloadIndex()` to update the running server's in-memory index.
  - Guarded by `DEV_DEBUG_SECRET` when set in `.env.local`. GET returns a short help message.

- `app/api/debug/reload-index/route.ts` (existing)
  - POST forces the server to re-read `data/subject_chunks.json` and return `{ ok: true, reloaded: true, chunks: <N> }` on success.
  - GET returns current index status and chunk count.

- `app/api/debug/used-chunks/route.ts`
  - Ad-hoc retrieval endpoint to test queries, returns top-K chunk ids, files, scores and excerpts.

- `app/api/debug/sessions/route.ts` and `app/api/debug/session/[id]/route.ts`
  - `GET /api/debug/sessions` lists recorded debug sessions.
  - `GET /api/debug/session/<id>?includeTexts=1` returns the session's retrieval records; with `includeTexts=1` the server enriches each chunk entry with the full text from the index.

- `lib/retrievalDebugStore.ts`
  - File-backed debug store persisted at `data/retrieval_debug.json` (works across Next dev workers).
  - Exposes `addRetrieval(sessionId, rec)`, `getRetrievals(sessionId)`, `listSessions()`, `clearSession(sessionId)`, `clearAll()`.

- `lib/pdfIndex.ts`
  - mtime-aware caching of `data/subject_chunks.json`.
  - `reloadIndex()` exported to force a reload.
  - `retrieveSubjectContextDetailed()` returns diagnostics: `{ id, file, text, score }` for top-K hits.

- `app/api/chat/route.ts`
  - Patched to call `retrieveSubjectContextDetailed()` for retrieval transparency.
  - Records retrievals via `addRetrieval()` into the file-backed store and returns a `x-debug-session` header with the session id (if not provided by client).

- `app/page.tsx`
  - Frontend debug overlay that captures `x-debug-session` header, lists available sessions, polls `/api/debug/session/:id` and displays retrieval records.

- `scripts/list-used-chunks.ts`
  - CLI to compute a query embedding and list top-K chunk ids/scores/excerpts.
  - Example: `npx ts-node scripts/list-used-chunks.ts --top=5 "Business Intelligence"`.

- `scripts/print-chunks.ts`
  - CLI to print full chunk text by id.
  - Example: `npx ts-node scripts/print-chunks.ts "predmet1.pdf#63"`.

- `data/retrieval_debug.json`
  - The file-backed debug store file; contains session(s) and retrieval records recorded during chat usage.

How to use (quick commands)
---------------------------
- Rebuild the index (runs indexer and reloads in-memory index):

```pwsh
# use x-dev-secret header only if you set DEV_DEBUG_SECRET in .env.local
curl -X POST http://localhost:3000/api/debug/rebuild-index -H "x-dev-secret: your-secret" -i
```

- Force reload of index (no re-indexing):

```pwsh
curl -X POST http://localhost:3000/api/debug/reload-index -i
curl http://localhost:3000/api/debug/reload-index -i  # GET status
```

- Test ad-hoc retrieval:

```pwsh
curl -X POST http://localhost:3000/api/debug/used-chunks -H "Content-Type: application/json" -d '{"query":"Business Intelligence","topK":5}' -i
```

- List debug sessions and fetch a session (with chunk texts):

```pwsh
curl http://localhost:3000/api/debug/sessions -i
curl "http://localhost:3000/api/debug/session/<sessionId>?includeTexts=1" -i
```

- Fetch a single chunk by id:

```pwsh
curl "http://localhost:3000/api/debug/chunk?id=predmet1.pdf#63" -i
```

- CLI examples:

```pwsh
npx ts-node scripts/list-used-chunks.ts --top=5 "Business Intelligence"
npx ts-node scripts/print-chunks.ts "predmet1.pdf#63"
```

Notes & cautions
----------------
- All debug endpoints are intended for local development only. If you set `DEV_DEBUG_SECRET` in `.env.local`, the rebuild endpoint requires `x-dev-secret`.
- Reindexing calls OpenAI for embeddings. Make sure `OPENAI_API_KEY` is set and you understand the API usage/latency.
- Changing `EMBEDDING_MODEL` requires re-running the indexer to regenerate embeddings (use the rebuild endpoint or run `node -r ts-node/register scripts/index-pdfs.ts`).
- The file-backed store `data/retrieval_debug.json` is used so sessions are visible across Next dev workers; avoid shipping it to production.

Next suggested tasks for tomorrow
-------------------------------
- (Optional) Make `rebuild-index` asynchronous (spawn and return a job id + logs endpoint).
- Add pagination/limits on `GET /api/debug/session/:id` if sessions grow large.
- Add a simple UI in the debug overlay to click a chunk id and open the PDF / text in the editor.
- Add `DEV_DEBUG_SECRET` usage to README or `.env.example`.

If you want this appended into `README.md` instead of a separate file, I can merge it in-place — tell me to proceed and I will append it to the top-level README.
