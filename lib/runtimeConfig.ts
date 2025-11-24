import fs from 'fs';
import path from 'path';
import { CHUNK_SIZE, CHUNK_OVERLAP, MIN_CHUNK_LENGTH, EMBEDDING_MODEL, TOP_K_DEFAULT, CHAT_TEMPERATURE, INCLUDE_SUBJECT_CONTEXT_DEFAULT } from './config';

const CFG_FILE = path.join(process.cwd(), 'data', 'local_config.json');

function ensureDataDir() {
  const dir = path.dirname(CFG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadRaw(): Record<string, any> {
  try {
    if (!fs.existsSync(CFG_FILE)) return {};
    const raw = fs.readFileSync(CFG_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

function saveRaw(obj: Record<string, any>) {
  try {
    ensureDataDir();
    fs.writeFileSync(CFG_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to write local config', e);
  }
}

export function getOverrides(): Record<string, any> {
  return loadRaw();
}

export function setOverrides(obj: Record<string, any>) {
  const cur = loadRaw();
  const merged = { ...cur, ...obj };
  saveRaw(merged);
  return merged;
}

// Return effective merged view of common runtime settings
export function getEffectiveConfig() {
  const o = loadRaw();
  return {
    CHUNK_SIZE: Number(o.CHUNK_SIZE ?? CHUNK_SIZE),
    CHUNK_OVERLAP: Number(o.CHUNK_OVERLAP ?? CHUNK_OVERLAP),
    MIN_CHUNK_LENGTH: Number(o.MIN_CHUNK_LENGTH ?? MIN_CHUNK_LENGTH),
    EMBEDDING_MODEL: String(o.EMBEDDING_MODEL ?? EMBEDDING_MODEL),
    TOP_K: Number(o.TOP_K ?? TOP_K_DEFAULT),
    CHAT_TEMPERATURE: Number(o.CHAT_TEMPERATURE ?? CHAT_TEMPERATURE),
    INCLUDE_SUBJECT_CONTEXT: (o.INCLUDE_SUBJECT_CONTEXT ?? INCLUDE_SUBJECT_CONTEXT_DEFAULT) === true || String(o.INCLUDE_SUBJECT_CONTEXT) === 'true',
  };
}

export default { getOverrides, setOverrides, getEffectiveConfig };
