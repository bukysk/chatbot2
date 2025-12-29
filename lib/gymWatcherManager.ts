import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { watchGymTxtFolder, TxtWatcherEvent, TxtWatcherHandle } from './txtWatcher';

const execAsync = promisify(exec);

export type GymWatcherStatus = {
  running: boolean;
  startedAt: string | null;
  processed: number;
  failed: number;
  lastFile: string | null;
  lastEvent: string | null;
  logs: string[];
  currentUrl: string | null;
  currentUrlIndex: number;
  totalUrls: number;
};

function nowIso() {
  return new Date().toISOString();
}

class GymWatcherManager {
  private handle: TxtWatcherHandle | null = null;
  private state: GymWatcherStatus = {
    running: false,
    startedAt: null,
    processed: 0,
    failed: 0,
    lastFile: null,
    lastEvent: null,
    logs: [],
    currentUrl: null,
    currentUrlIndex: 0,
    totalUrls: 0,
  };

  private gymRoot() {
    return path.join(process.cwd(), 'data', 'gym');
  }

  private processedPostIds(): string[] {
    const root = this.gymRoot();
    if (!fs.existsSync(root)) return [];
    const entries = fs.readdirSync(root).map(name => ({ name, full: path.join(root, name) }));
    return entries
      .filter(e => !e.name.startsWith('_'))
      .filter(e => {
        try {
          return fs.statSync(e.full).isDirectory();
        } catch {
          return false;
        }
      })
      .map(e => e.name);
  }

  private appendLog(msg: string) {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.state.logs = [...this.state.logs, line].slice(-200);
  }

  private onEvent(ev: TxtWatcherEvent) {
    if (ev.type === 'processed') {
      this.state.processed += 1;
      this.state.lastFile = path.basename(ev.file);
      this.state.lastEvent = `processed ${path.basename(ev.file)}`;
    } else if (ev.type === 'failed') {
      this.state.failed += 1;
      this.state.lastFile = path.basename(ev.file);
      this.state.lastEvent = `failed ${path.basename(ev.file)}${ev.detail ? `: ${ev.detail}` : ''}`;
    } else if (ev.type === 'processing') {
      this.state.lastFile = path.basename(ev.file);
      this.state.lastEvent = `processing ${path.basename(ev.file)}`;
    }
  }

  private resetCounts() {
    this.state.processed = 0;
    this.state.failed = 0;
    this.state.lastFile = null;
    this.state.lastEvent = null;
    this.state.logs = [];
    this.state.currentUrl = null;
    this.state.currentUrlIndex = 0;
    this.state.totalUrls = 0;
  }

  async start() {
    if (this.state.running) return this.status();
    this.resetCounts();
    this.state.running = true;
    this.state.startedAt = nowIso();
    this.appendLog('Watcher starting');

    const already = this.processedPostIds();
    this.state.processed = already.length;
    if (already.length > 0) {
      this.appendLog(`Resume info: found ${already.length} processed post folder(s) in data/gym`);
    } else {
      this.appendLog('Resume info: no processed post folders found yet');
    }

    this.handle = watchGymTxtFolder(async (filePath, content) => {
      this.appendLog(`→ file detected: ${path.basename(filePath)}`);
      const urls = content
        .split(/\r?\n/)
        .map(u => u.trim())
        .filter(Boolean);
      
      this.state.totalUrls = urls.length;
      this.appendLog(`→ found ${urls.length} URLs, starting processing...`);
      this.state.lastFile = path.basename(filePath);
      this.state.lastEvent = `processing ${path.basename(filePath)}`;

      if (urls.length === 0) {
        this.appendLog('⚠ no URLs found in file');
        return;
      }

      // Process each URL one by one
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        this.state.currentUrlIndex = i + 1;
        this.state.currentUrl = url;
        
        try {
          // Extract the post ID from Instagram URL (e.g., /p/DSQcUEmiHRb/ -> DSQcUEmiHRb)
          const match = url.match(/\/p\/([^\/]+)/);
          const postId = match?.[1] || `url_${i + 1}`;
          const outputDir = path.join(process.cwd(), 'data', 'gym', postId);

          if (already.includes(postId)) {
            this.state.lastEvent = `skipped ${i + 1}/${urls.length}`;
            this.appendLog(`[${i + 1}/${urls.length}] skip (already processed): ${postId}`);
            continue;
          }

          this.state.lastEvent = `scraping ${i + 1}/${urls.length}`;
          this.appendLog(`[${i + 1}/${urls.length}] → ${url}`);
          
          // Create output directory
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            this.appendLog(`  created folder: ${postId}`);
          }
          
          const cmd = `transcribe-anything "${url}" --language sk --model small --output "${outputDir}"`;
          this.appendLog(`  cmd: transcribe-anything [url] --language sk --model small --output ${postId}`);
          const { stdout, stderr } = await execAsync(cmd, { 
            cwd: process.cwd(),
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
          });
          if (stdout) this.appendLog(`  ✓ output: ${stdout.trim().slice(0, 150)}`);
          if (stderr) this.appendLog(`  ! stderr: ${stderr.trim().slice(0, 150)}`);
          this.appendLog(`  ✓ done [${i + 1}/${urls.length}] → ${postId}/`);
          this.state.processed += 1;
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          this.appendLog(`  ✗ error [${i + 1}/${urls.length}]: ${errMsg.slice(0, 150)}`);
          this.state.failed += 1;
        }
      }
      
      this.state.currentUrl = null;
      this.state.currentUrlIndex = 0;
      this.appendLog(`✓ completed all ${urls.length} URLs from ${path.basename(filePath)}`);
    }, {
      logger: (msg) => this.appendLog(msg),
      onEvent: (ev) => {
        this.onEvent(ev);
        if (ev.type === 'failed' && ev.detail) this.appendLog(ev.detail);
      },
      stableWaitMs: 800,
      stableChecks: 8
    });

    return this.status();
  }

  stop() {
    if (this.handle) {
      this.handle.stop();
      this.handle = null;
    }
    if (this.state.running) this.appendLog('Watcher stopped');
    this.state.running = false;
    return this.status();
  }

  status(): GymWatcherStatus {
    return { ...this.state, logs: [...this.state.logs] };
  }
}

export const gymWatcherManager = new GymWatcherManager();
export function getGymWatcherStatus() { return gymWatcherManager.status(); }
export function startGymWatcher() { return gymWatcherManager.start(); }
export function stopGymWatcher() { return gymWatcherManager.stop(); }
