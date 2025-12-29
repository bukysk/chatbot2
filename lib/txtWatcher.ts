import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';

export type TxtProcessFn = (filePath: string, content: string) => Promise<void>;

export type TxtWatcherEvent = {
  type: 'processing' | 'processed' | 'failed' | 'skipped';
  file: string;
  detail?: string;
  dest?: string;
};

export type TxtWatcherOptions = {
  dir: string;
  processFile: TxtProcessFn;
  doneDirName?: string;
  errorDirName?: string;
  includeExisting?: boolean;
  logger?: (msg: string) => void;
  onEvent?: (ev: TxtWatcherEvent) => void;
  stableWaitMs?: number;
  stableChecks?: number;
};

export type TxtWatcherHandle = { stop: () => void };

export function watchTxtFolder(opts: TxtWatcherOptions): TxtWatcherHandle {
  const dir = path.resolve(opts.dir);
  const doneDir = path.resolve(dir, opts.doneDirName ?? '_done');
  const errorDir = path.resolve(dir, opts.errorDirName ?? '_error');
  const logger = opts.logger ?? (() => {});
  const stableWaitMs = opts.stableWaitMs ?? 300;
  const stableChecks = opts.stableChecks ?? 4;

  const queue: string[] = [];
  let processing = false;
  let stopped = false;
  let watcher: fs.FSWatcher | null = null;

  const isTxt = (p: string) => path.extname(p).toLowerCase() === '.txt';
  const isInWorkingDir = (p: string) => p.startsWith(dir) && !p.startsWith(doneDir) && !p.startsWith(errorDir);

  async function ensureDirs() {
    await fsp.mkdir(dir, { recursive: true });
    await fsp.mkdir(doneDir, { recursive: true });
    await fsp.mkdir(errorDir, { recursive: true });
  }

  async function waitForStableFile(file: string) {
    let lastSize = -1;
    for (let i = 0; i < stableChecks; i++) {
      const stat = await fsp.stat(file).catch(() => null);
      if (!stat) break;
      if (stat.size === lastSize && stat.size > 0) return true;
      lastSize = stat.size;
      await new Promise(res => setTimeout(res, stableWaitMs));
    }
    return false;
  }

  function enqueue(file: string) {
    if (stopped) return;
    if (!isTxt(file) || !isInWorkingDir(file)) return;
    if (!queue.includes(file)) {
      queue.push(file);
      run();
    }
  }

  async function moveSafe(src: string, destDir: string) {
    const target = path.join(destDir, path.basename(src));
    try {
      await fsp.rename(src, target);
      return target;
    } catch {
      await fsp.copyFile(src, target);
      await fsp.unlink(src).catch(() => {});
      return target;
    }
  }

  async function run() {
    if (processing || stopped) return;
    const file = queue.shift();
    if (!file) return;
    processing = true;
    try {
      opts.onEvent?.({ type: 'processing', file });
      const ready = await waitForStableFile(file);
      if (!ready) throw new Error('File not stable yet');
      const content = await fsp.readFile(file, 'utf8');
      await opts.processFile(file, content);
      const dest = await moveSafe(file, doneDir);
      logger(`processed ${path.basename(file)}`);
      opts.onEvent?.({ type: 'processed', file, dest });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logger(`failed ${path.basename(file)}: ${detail}`);
      opts.onEvent?.({ type: 'failed', file, detail });
      try {
        await moveSafe(file, errorDir);
      } catch {}
    } finally {
      processing = false;
      run();
    }
  }

  async function seedExisting() {
    if (opts.includeExisting === false) return;
    const entries = await fsp.readdir(dir).catch(() => []);
    const files = await Promise.all(entries.map(async name => {
      const full = path.join(dir, name);
      const stat = await fsp.stat(full).catch(() => null);
      return stat?.isFile() ? { full, mtime: stat.mtimeMs } : null;
    }));
    files
      .filter(Boolean)
      .filter(f => isTxt((f as any).full) && isInWorkingDir((f as any).full))
      .sort((a: any, b: any) => (a?.mtime ?? 0) - (b?.mtime ?? 0))
      .forEach((f: any) => enqueue(f.full));
  }

  function startWatcher() {
    watcher = fs.watch(dir, { persistent: true }, (_event, fname) => {
      if (!fname) return;
      const full = path.join(dir, fname.toString());
      enqueue(full);
    });
  }

  ensureDirs()
    .then(() => seedExisting())
    .then(() => startWatcher())
    .catch(err => {
      logger(`txt watcher failed to start: ${err instanceof Error ? err.message : String(err)}`);
    });

  return {
    stop() {
      stopped = true;
      watcher?.close();
      queue.length = 0;
    }
  };
}

// Convenience helper that targets the default gym folder under data/
export function watchGymTxtFolder(
  processFile: TxtProcessFn,
  opts?: { 
    logger?: (msg: string) => void; 
    onEvent?: (ev: TxtWatcherEvent) => void;
    stableWaitMs?: number;
    stableChecks?: number;
  }
) {
  const dir = path.join(process.cwd(), 'data', 'gym');
  return watchTxtFolder({ 
    dir, 
    processFile, 
    logger: opts?.logger, 
    onEvent: opts?.onEvent,
    stableWaitMs: opts?.stableWaitMs,
    stableChecks: opts?.stableChecks
  });
}
