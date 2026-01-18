import path from 'path';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type InstagramScraperStatus = {
  running: boolean;
  startedAt: string | null;
  processed: number;
  failed: number;
  skipped: number;
  lastUrl: string | null;
  lastEvent: string | null;
  logs: string[];
  currentUrl: string | null;
  currentUrlIndex: number;
  totalUrls: number;
  currentUsername: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function sanitizeUsername(u: string): string | null {
  const trimmed = (u || '').trim();
  if (!trimmed) return null;
  return /^[A-Za-z0-9._]+$/.test(trimmed) ? trimmed : null;
}

function checkYtDlpInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('yt-dlp', ['--version'], { shell: false });
    let resolved = false;
    
    proc.on('error', () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
    
    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        resolve(code === 0);
      }
    });
    
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve(false);
      }
    }, 2000);
  });
}

function runYtDlp(username: string): Promise<{ urls: string[]; stderr: string }> {
  return new Promise((resolve, reject) => {
    const args = ['--flat-playlist', '--print', '%(url)s', `https://www.instagram.com/${username}/`];
    const proc = spawn('yt-dlp', args, { shell: false });
    let stdout = '';
    let stderr = '';

    const killTimer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('yt-dlp timed out (30s)'));
    }, 30_000);

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', err => {
      clearTimeout(killTimer);
      reject(err);
    });
    proc.on('close', code => {
      clearTimeout(killTimer);
      if (code === 0) {
        const urls = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        resolve({ urls, stderr: stderr.trim() });
      } else {
        const errMsg = stderr || stdout || 'unknown error';
        reject(new Error(`yt-dlp exited with code ${code}: ${errMsg}`));
      }
    });
  });
}

class InstagramScraperManager {
  private state: InstagramScraperStatus = {
    running: false,
    startedAt: null,
    processed: 0,
    failed: 0,
    skipped: 0,
    lastUrl: null,
    lastEvent: null,
    logs: [],
    currentUrl: null,
    currentUrlIndex: 0,
    totalUrls: 0,
    currentUsername: null,
  };

  private outputRoot() {
    return path.join(process.cwd(), 'data', 'instagram');
  }

  private processedPostIds(): string[] {
    const root = this.outputRoot();
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

  private resetCounts() {
    this.state.processed = 0;
    this.state.failed = 0;
    this.state.skipped = 0;
    this.state.lastUrl = null;
    this.state.lastEvent = null;
    this.state.logs = [];
    this.state.currentUrl = null;
    this.state.currentUrlIndex = 0;
    this.state.totalUrls = 0;
    this.state.currentUsername = null;
  }

  async scrapeAccount(username: string): Promise<InstagramScraperStatus> {
    if (this.state.running) {
      throw new Error('Scraper is already running');
    }

    const cleanUsername = sanitizeUsername(username);
    if (!cleanUsername) {
      throw new Error('Invalid Instagram username. Use only letters, numbers, dots, and underscores.');
    }

    this.resetCounts();
    this.state.running = true;
    this.state.startedAt = nowIso();
    this.state.currentUsername = cleanUsername;
    this.appendLog(`Starting scrape for @${cleanUsername}`);

    try {
      // Check if yt-dlp is installed
      this.appendLog('Checking for yt-dlp...');
      const ytDlpAvailable = await checkYtDlpInstalled();
      if (!ytDlpAvailable) {
        throw new Error('yt-dlp is not installed or not in PATH. Install it with: pip install yt-dlp');
      }
      this.appendLog('✓ yt-dlp found');
      // Ensure output directory exists
      const outputRoot = this.outputRoot();
      if (!fs.existsSync(outputRoot)) {
        fs.mkdirSync(outputRoot, { recursive: true });
        this.appendLog(`Created output directory: ${outputRoot}`);
      }

      // Get already processed posts
      const already = this.processedPostIds();
      if (already.length > 0) {
        this.appendLog(`Found ${already.length} already processed post(s)`);
      }

      // Fetch URLs from Instagram account
      this.appendLog(`Fetching video URLs from @${cleanUsername}...`);
      const { urls, stderr } = await runYtDlp(cleanUsername);
      
      if (stderr) {
        this.appendLog(`yt-dlp stderr: ${stderr.slice(0, 200)}`);
      }

      this.state.totalUrls = urls.length;
      this.appendLog(`Found ${urls.length} video(s)`);

      if (urls.length === 0) {
        this.appendLog('⚠ No videos found');
        this.state.running = false;
        return this.status();
      }

      // Process each URL
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        this.state.currentUrlIndex = i + 1;
        this.state.currentUrl = url;

        try {
          // Extract post ID from URL (e.g., /p/DSQcUEmiHRb/ -> DSQcUEmiHRb)
          const match = url.match(/\/p\/([^\/]+)/);
          const postId = match?.[1] || `url_${i + 1}`;
          const outputDir = path.join(this.outputRoot(), postId);

          // Skip if already processed
          if (already.includes(postId)) {
            this.state.skipped += 1;
            this.state.lastEvent = `skipped ${i + 1}/${urls.length}`;
            this.appendLog(`[${i + 1}/${urls.length}] ⊘ skip (already processed): ${postId}`);
            continue;
          }

          this.state.lastEvent = `processing ${i + 1}/${urls.length}`;
          this.state.lastUrl = url;
          this.appendLog(`[${i + 1}/${urls.length}] → ${url}`);

          // Create output directory
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            this.appendLog(`  created folder: ${postId}`);
          }

          // Run transcribe-anything
          const cmd = `transcribe-anything "${url}" --language sk --model small --output "${outputDir}"`;
          this.appendLog(`  cmd: transcribe-anything [url] --language sk --model small --output ${postId}`);
          
          const { stdout, stderr: cmdStderr } = await execAsync(cmd, {
            cwd: process.cwd(),
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
          });

          if (stdout) this.appendLog(`  ✓ output: ${stdout.trim().slice(0, 150)}`);
          if (cmdStderr) this.appendLog(`  ! stderr: ${cmdStderr.trim().slice(0, 150)}`);
          
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
      this.appendLog(`✓ Completed scraping @${cleanUsername}: ${this.state.processed} processed, ${this.state.skipped} skipped, ${this.state.failed} failed`);

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.appendLog(`✗ Fatal error: ${errMsg}`);
      throw err;
    } finally {
      this.state.running = false;
    }

    return this.status();
  }

  status(): InstagramScraperStatus {
    return { ...this.state, logs: [...this.state.logs] };
  }

  isRunning(): boolean {
    return this.state.running;
  }
}

export const instagramScraperManager = new InstagramScraperManager();
export function getInstagramScraperStatus() { return instagramScraperManager.status(); }
export function scrapeInstagramAccount(username: string) { return instagramScraperManager.scrapeAccount(username); }
export function isInstagramScraperRunning() { return instagramScraperManager.isRunning(); }
