import fs from 'fs';
import path from 'path';

type RetrievedChunk = { id: string; file: string; text: string; score: number };
type RetrievalRecord = {
  timestamp: string;
  query: string;
  chunks: RetrievedChunk[];
  // optional snapshot of last user message or messages
  messages?: any;
};

// File-backed store to make debug sessions visible across Next dev workers/processes.
const DEBUG_FILE = path.join(process.cwd(), 'data', 'retrieval_debug.json');

function ensureDataDir() {
  const dir = path.dirname(DEBUG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadStore(): Record<string, RetrievalRecord[]> {
  try {
    if (!fs.existsSync(DEBUG_FILE)) return {};
    const raw = fs.readFileSync(DEBUG_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

function saveStore(storeObj: Record<string, RetrievalRecord[]>) {
  try {
    ensureDataDir();
    fs.writeFileSync(DEBUG_FILE, JSON.stringify(storeObj, null, 2), 'utf8');
  } catch (e) {
    // ignore write errors in dev
    console.warn('Failed to write retrieval debug file', e);
  }
}

export function addRetrieval(sessionId: string, rec: RetrievalRecord) {
  const storeObj = loadStore();
  const arr = storeObj[sessionId] || [];
  arr.push(rec);
  // cap entries
  if (arr.length > 200) arr.splice(0, arr.length - 200);
  storeObj[sessionId] = arr;
  saveStore(storeObj);
}

export function getRetrievals(sessionId: string): RetrievalRecord[] | null {
  const storeObj = loadStore();
  return storeObj[sessionId] ?? null;
}

export function listSessions(): { id: string; lastSeen: string; count: number }[] {
  const storeObj = loadStore();
  const out: { id: string; lastSeen: string; count: number }[] = [];
  for (const id of Object.keys(storeObj)) {
    const arr = storeObj[id] || [];
    out.push({ id, lastSeen: arr[arr.length - 1]?.timestamp ?? '', count: arr.length });
  }
  return out.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
}

export function clearSession(sessionId: string) {
  const storeObj = loadStore();
  delete storeObj[sessionId];
  saveStore(storeObj);
}

export function clearAll() {
  saveStore({});
}
