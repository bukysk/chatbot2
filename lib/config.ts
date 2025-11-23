// Canonical runtime configuration for server and indexer, driven by environment variables.
// Set these in `.env.local` or your shell. Defaults are provided for local dev.
// This file is the single source of truth for chat settings, embedding model, chunking
// behavior, and the system prompt. `scripts/index-pdfs.ts` imports these values so
// you can tune everything in one place.

function intEnv(name: string, fallback: number) {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

// Defaults chosen to work well for document indexing (characters, not tokens).
// These defaults are used when no corresponding env var is set. Tweak via `.env.local`.
export const CHUNK_SIZE = intEnv('CHUNK_SIZE', 1400);
export const CHUNK_OVERLAP = intEnv('CHUNK_OVERLAP', 150);
export const MIN_CHUNK_LENGTH = intEnv('MIN_CHUNK_LENGTH', 60);

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
export const TOP_K_DEFAULT = intEnv('TOP_K', 3);

// Export OpenAI model for chat completions (used in server code)
export const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-4o-mini';

// Export temperature default for completions
export const CHAT_TEMPERATURE = Number(process.env.CHAT_TEMPERATURE ?? 0.7);

// Utility: whether to include subject context by default
export const INCLUDE_SUBJECT_CONTEXT_DEFAULT = (process.env.INCLUDE_SUBJECT_CONTEXT ?? 'true') === 'true';

// Note: keep secrets like OPENAI_API_KEY in .env.local or the hosting provider's environment settings.

// Prompt template used to build the system message for chat completion.
// Use the marker `{{PROFILE}}` which will be replaced by the frontend with the student's profile.
export const PROMPT_TEMPLATE = process.env.PROMPT_TEMPLATE || `
Si poradca pre záverečné práce Fakulty Hospodárskej informatiky (EU v Bratislave).
Tvojou úlohou je odporučiť vhodné témy záverečnej práce na základe PROFILU študenta (JSON) uvedeného v placeholderi {{PROFILE}} a priloženého doplňujúceho kontextu (PDF chunky).

Zásady práce s informáciami:
- Použi iba informácie, ktoré sú explicitne dostupné v priložených PDF chunkoch a v študentskom profile.
- Nevymýšľaj žiadne nové fakty, údaje ani témy, ktoré nie sú uvedené v profilových údajoch alebo v PDF.
- Ak v priložených materiáloch chýbajú potrebné informácie, odpovedz presnou vetou:
  "Nemám dostatočné informácie v priložených materiáloch na bezpečné zodpovedanie tejto otázky."
- Ak použiješ informáciu z konkrétneho PDF chunku, označ ju referenciou [1], [2], atď.

Ako máš postupovať:
1. Na základe PROFILU odporuč 3 až 5 konkrétnych tém (bakalárskych alebo inžinierskych).
2. Pri každej téme uveď:
   - Názov témy
   - Stručný popis
   - Metódy / dáta (vrátane odkazov na relevantné PDF chunky, ak existujú)
   - Prečo sedí na študenta (na základe profilu JSON)
   - Riziká alebo potenciálne slabé miesta
3. Po odporučení tém polož 1 až 2 doplňujúce otázky, ktoré ti pomôžu odporúčanie spresniť.
4. Ak študent odpovie, prispôsob odporúčania, vyraď nevhodné témy a pridaj nové.
5. Nepíš dlhé bloky textu; buď stručný, jasný a vecný.
6. Odpovedaj po slovensky.

Pravidlá konverzácie:
- Neopakuj celý profil.
- Nikdy nezahrňuj obsah, ktorý nie je podporený profilom alebo PDF.
- Pri nejasnostiach polož otázku, nepredpokladaj.
- Cieľom konverzácie je pomôcť študentovi vybrať jednu finálnu tému, ktorá mu najlepšie sedí.

Formát odpovede (presne dodrž):

NÁZOV TÉMY
Stručný popis.
Metódy / dáta: ...
Prečo sedí: ...
Riziká: ...

Takto pokračuj pre všetky odporúčané témy.

Potom:

Doplňujúce otázky:
1. ...
2. ...
`;
