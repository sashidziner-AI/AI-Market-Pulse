/**
 * TTS narration generator + audio mux for the walkthrough video.
 *
 * Pipeline:
 *   1. Parse outputs/video/narration-script.md and extract every narrator
 *      block (lines matching `> **Narrator:** ...` — possibly wrapped).
 *   2. Call the app's /api/jarvis/tts endpoint (which uses OpenAI's TTS)
 *      once per block to render an MP3 chunk.
 *   3. Concatenate chunks with ~700ms of silence between them via ffmpeg
 *      concat, giving natural pauses between segments.
 *   4. Mux the combined MP3 onto raw-walkthrough.webm to produce
 *      final-walkthrough.mp4. Video is trimmed to audio length via
 *      -shortest so the total lands near the 4-5 minute target instead
 *      of the raw ~7:30 (which includes 3 minutes of AI pipeline wait).
 *
 * Usage:  node scripts/build-narration.mjs
 * Requires:
 *   - Dev server running at http://localhost:3000 (for /api/jarvis/tts)
 *   - OPENAI_API_KEY in .env
 *   - ffmpeg on PATH
 *   - outputs/video/raw-walkthrough.webm produced by record-walkthrough.mjs
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

const BASE_URL = process.env.DEMO_URL || 'http://localhost:3000';
const SCRIPT_PATH = path.resolve('outputs/video/narration-script.md');
const OUT_DIR = path.resolve('outputs/video');
const CHUNKS_DIR = path.resolve('outputs/video/_narration-chunks');
const RAW_VIDEO = path.join(OUT_DIR, 'raw-walkthrough.webm');
const NARRATION_MP3 = path.join(OUT_DIR, 'narration.mp3');
const FINAL_MP4 = path.join(OUT_DIR, 'final-walkthrough.mp4');
const SILENCE_MP3 = path.join(CHUNKS_DIR, '_silence-700ms.mp3');
const VOICE = process.env.TTS_VOICE || 'onyx';

function extractNarratorBlocks(md) {
  // Match blocks that begin with `> **Narrator:**` (possibly with a
  // leading marker like `> **User:**` in dialogues) and pull the rest.
  // Blocks may span multiple lines (continuation with `> `).
  const lines = md.split(/\r?\n/);
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const startMatch = line.match(/^>\s*\*\*Narrator:\*\*\s*(.*)$/);
    if (startMatch) {
      if (current) blocks.push(current);
      current = startMatch[1].trim();
      continue;
    }
    // Blockquote continuation
    const contMatch = line.match(/^>\s?(.*)$/);
    if (contMatch && current !== null) {
      const cont = contMatch[1].trim();
      // Blank blockquote line = paragraph break within same block
      current += cont ? ' ' + cont : ' ';
    } else if (current !== null) {
      // Non-blockquote line ends the current narrator block
      blocks.push(current);
      current = null;
    }
  }
  if (current !== null) blocks.push(current);
  // Clean up: strip italic asterisks, collapse whitespace, remove empty.
  return blocks
    .map((b) => b.replace(/\*/g, '').replace(/\s+/g, ' ').trim())
    .filter((b) => b.length > 0);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: opts.stdio || 'inherit', shell: false, ...opts });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with ${code}`));
    });
    child.on('error', reject);
  });
}

async function fetchTtsMp3(text, outPath) {
  const res = await fetch(`${BASE_URL}/api/jarvis/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: VOICE }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TTS failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buffer);
  return buffer.length;
}

async function makeSilenceMp3(outPath, durationSec = 0.7) {
  // 24 kHz mono silence to match OpenAI TTS's native format so ffmpeg's
  // concat demuxer sees consistent codec parameters across all chunks.
  // Output resampling to 44.1 kHz stereo happens at the final encode step.
  await run('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', `anullsrc=r=24000:cl=mono`,
    '-t', String(durationSec),
    '-q:a', '9', '-acodec', 'libmp3lame',
    outPath,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
}

async function main() {
  // Sanity checks
  if (!fsSync.existsSync(RAW_VIDEO)) {
    throw new Error(`Missing ${RAW_VIDEO}. Run scripts/record-walkthrough.mjs first.`);
  }
  const md = await fs.readFile(SCRIPT_PATH, 'utf8');
  const blocks = extractNarratorBlocks(md);
  if (blocks.length === 0) {
    throw new Error('No narrator blocks found in narration-script.md');
  }
  console.log(`Extracted ${blocks.length} narrator blocks:\n`);
  blocks.forEach((b, i) => {
    const preview = b.length > 100 ? b.slice(0, 100) + '…' : b;
    console.log(`  [${i + 1}/${blocks.length}] ${preview}`);
  });

  await fs.mkdir(CHUNKS_DIR, { recursive: true });

  // Generate silence chunk once — reused between segments.
  console.log('\nGenerating silence buffer...');
  await makeSilenceMp3(SILENCE_MP3, 0.7);

  // Generate TTS for each block sequentially (avoid hammering the API).
  console.log('\nGenerating TTS chunks (this can take 1-2 minutes)...');
  const chunkPaths = [];
  for (let i = 0; i < blocks.length; i++) {
    const chunkPath = path.join(CHUNKS_DIR, `chunk-${String(i + 1).padStart(2, '0')}.mp3`);
    const bytes = await fetchTtsMp3(blocks[i], chunkPath);
    console.log(`  chunk-${i + 1}: ${(bytes / 1024).toFixed(1)} KB`);
    chunkPaths.push(chunkPath);
  }

  // Build the ffmpeg concat list. Alternate: chunk, silence, chunk, silence...
  console.log('\nConcatenating chunks with silence pauses...');
  const listPath = path.join(CHUNKS_DIR, '_concat-list.txt');
  const entries = [];
  chunkPaths.forEach((p, i) => {
    entries.push(`file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
    if (i < chunkPaths.length - 1) {
      entries.push(`file '${SILENCE_MP3.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
    }
  });
  await fs.writeFile(listPath, entries.join('\n'), 'utf8');

  // Concat + resample to the universal 44.1 kHz stereo standard. OpenAI
  // TTS ships 24 kHz mono, which some legacy players (Windows Media Player,
  // older QuickTime) silently refuse to play. Resampling here fixes both
  // narration.mp3 and the muxed MP4 downstream.
  await run('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-ar', '44100', '-ac', '2',
    '-c:a', 'libmp3lame', '-b:a', '192k',
    NARRATION_MP3,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log(`Narration MP3 written to ${NARRATION_MP3} (44.1 kHz stereo)`);

  // Mux narration onto the video. -shortest trims the video to narration
  // length, which usually lands near the 4-5 min target and removes the
  // trailing "pipeline waiting" dead time.
  console.log('\nMuxing narration onto video...');
  await run('ffmpeg', [
    '-y',
    '-i', RAW_VIDEO,
    '-i', NARRATION_MP3,
    '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-level', '4.0',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2',
    '-map', '0:v:0', '-map', '1:a:0',
    '-shortest',
    '-movflags', '+faststart',
    FINAL_MP4,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });

  console.log(`\n✓ Final video: ${FINAL_MP4}`);
  console.log('  (Video trimmed to narration length via -shortest)');
}

main().catch((err) => {
  console.error('\nbuild-narration failed:', err.message);
  process.exit(1);
});
