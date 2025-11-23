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
- Slow/no stream: verify network & model availability.
- Tailwind class warning: updated to new v4 naming (`bg-linear-to-br`).

Enjoy building with your new chatbot! 🚀
