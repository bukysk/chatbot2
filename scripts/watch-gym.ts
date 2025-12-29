import path from 'path';
import { watchGymTxtFolder } from '../lib/txtWatcher';

// Replace this with your actual transcription logic.
async function processGymFile(filePath: string, content: string) {
  // Example: treat the file as a list of URLs (one per line)
  const urls = content
    .split(/\r?\n/)
    .map(u => u.trim())
    .filter(Boolean);

  console.log(`Got ${urls.length} URLs from`, filePath);
  for (const url of urls) {
    console.log('-> TODO transcribe', url);
    // await transcribeUrl(url);
  }
}

// Start watching data/gym for incoming .txt files
watchGymTxtFolder(processGymFile, msg => console.log('[gym-watch]', msg));

console.log('Watching data/gym for .txt files...');
