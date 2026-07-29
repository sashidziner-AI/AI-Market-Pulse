/**
 * Voice-synced slideshow builder.
 *
 * Instead of a live walkthrough (where the video and voiceover drift),
 * this builds a slideshow where each screenshot is displayed for the
 * EXACT duration of its matching narration MP3 chunk.
 *
 * Pipeline:
 *   1. For each (screenshot, narration-chunk) pair, produce a short MP4
 *      with the still image on-screen and the narration as audio.
 *   2. Concatenate all segment MP4s into outputs/video/final-walkthrough.mp4.
 *
 * Chunks are ordered logically: filler blocks (12 & 13) are slotted at
 * their natural spots (dashboard scan wait, deep-analysis wait) so the
 * story reads: intro → analyze → dashboard load → tabs → account detail
 * → deep-analysis → Jarvis → saved reports → closing.
 *
 * Usage:  node scripts/build-slideshow.mjs
 * Requires:
 *   - outputs/video/_narration-chunks/chunk-*.mp3 (from build-narration.mjs)
 *   - outputs/screenshots/*.png (from capture-screens.mjs)
 *   - ffmpeg on PATH
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const CHUNKS_DIR = path.resolve('outputs/video/_narration-chunks');
const SCREENSHOTS_DIR = path.resolve('outputs/screenshots');
const OUT_DIR = path.resolve('outputs/video');
const SEG_DIR = path.resolve('outputs/video/_slideshow-segments');
const FINAL_MP4 = path.join(OUT_DIR, 'final-walkthrough.mp4');
const NARRATION_ORDERED = path.join(OUT_DIR, 'narration.mp3');

// Slideshow story order — each entry pairs a narration chunk with the
// screenshot to display while it plays. Landing sections use named chunks
// (chunk-landing-<slug>.mp3) from scripts/capture-landing.mjs. Workspace
// segments use numeric chunks (chunk-NN.mp3) from build-narration.mjs.
// Filler chunks (12 & 13) slot at natural pause points so the visual story
// matches what the narrator is describing.
const SEGMENTS = [
  // -- Landing tour (section-by-section, each viewport-sized for readability) --
  { chunk: 'landing-hero',         screen: 'landing-01-hero.png',         label: 'Landing — Hero' },
  { chunk: 'landing-features',     screen: 'landing-02-features.png',     label: 'Landing — Features' },
  { chunk: 'landing-how',          screen: 'landing-03-how.png',          label: 'Landing — How it works' },
  { chunk: 'landing-capabilities', screen: 'landing-04-capabilities.png', label: 'Landing — Capabilities' },
  { chunk: 'landing-market',       screen: 'landing-05-market.png',       label: 'Landing — Market opportunity' },
  { chunk: 'landing-cta',          screen: 'landing-06-cta.png',          label: 'Landing — Call to action' },
  // -- Workspace tour --
  { chunk:  2, screen: '02-analyze-input.png',             label: 'Analyze Website — paste URL' },
  { chunk:  3, screen: '03-dashboard-analysis.png',        label: 'Dashboard Analysis tab' },
  { chunk: 12, screen: '06-dashboard-pipeline.png',        label: 'Filler — AI scanning the web (pipeline loading)' },
  { chunk:  4, screen: '04-dashboard-segments.png',        label: 'Target Segments' },
  { chunk:  5, screen: '05-dashboard-partner-pathways.png', label: 'Partner Pathways' },
  { chunk:  6, screen: '06-dashboard-pipeline.png',        label: 'GTM Pipeline (populated)' },
  { chunk:  7, screen: '07-dashboard-leads.png',           label: 'Leads' },
  { chunk:  8, screen: '08-account-detail.png',            label: 'Account Detail — buyer personas & citations' },
  { chunk: 13, screen: '08-account-detail.png',            label: 'Filler — deep-analysis streaming panel' },
  { chunk:  9, screen: '07-dashboard-leads.png',           label: 'Jarvis — voice command opens Leads tab' },
  { chunk: 10, screen: '09-saved-reports.png',             label: 'Saved Reports library' },
  { chunk: 11, screen: 'landing-01-hero.png',              label: 'Closing — back to landing hero' },
];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: opts.stdio || ['ignore', 'ignore', 'inherit'], shell: false, ...opts });
    child.on('exit', (code) => { code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)); });
    child.on('error', reject);
  });
}

async function chunkPath(n) {
  // Numeric chunk → chunk-NN.mp3 (from build-narration.mjs).
  // String chunk → chunk-<name>.mp3 (e.g. landing-hero → chunk-landing-hero.mp3).
  if (typeof n === 'number') {
    return path.join(CHUNKS_DIR, `chunk-${String(n).padStart(2, '0')}.mp3`);
  }
  return path.join(CHUNKS_DIR, `chunk-${n}.mp3`);
}

async function main() {
  // Sanity checks
  for (const { chunk, screen } of SEGMENTS) {
    const cp = await chunkPath(chunk);
    if (!fsSync.existsSync(cp)) throw new Error(`Missing narration chunk: ${cp}`);
    const sp = path.join(SCREENSHOTS_DIR, screen);
    if (!fsSync.existsSync(sp)) throw new Error(`Missing screenshot: ${sp}`);
  }

  await fs.mkdir(SEG_DIR, { recursive: true });

  // -------------------------------------------------------------------
  // 1. Build one MP4 per segment (still image + narration audio).
  //    -shortest makes each segment exactly the audio length.
  //    -tune stillimage optimises x264 encoding for a static frame,
  //    keeping the file tiny.
  // -------------------------------------------------------------------
  console.log(`Building ${SEGMENTS.length} slideshow segments...`);
  const segmentPaths = [];
  for (let i = 0; i < SEGMENTS.length; i++) {
    const seg = SEGMENTS[i];
    const outSeg = path.join(SEG_DIR, `seg-${String(i + 1).padStart(2, '0')}.mp4`);
    const imgPath = path.join(SCREENSHOTS_DIR, seg.screen);
    const audPath = await chunkPath(seg.chunk);
    console.log(`  [${i + 1}/${SEGMENTS.length}] ${seg.label}`);
    await run('ffmpeg', [
      '-y',
      '-loop', '1', '-framerate', '25', '-i', imgPath,
      '-i', audPath,
      // Fit the image into a 1440x900 canvas, letterboxing tall full-page
      // screenshots (many are longer than 900px). Scale down proportionally,
      // pad with a dark background to reach 1440x900.
      '-vf', 'scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x1F1F20,setsar=1',
      '-c:v', 'libx264', '-tune', 'stillimage', '-crf', '20', '-preset', 'medium',
      '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2',
      '-shortest', '-movflags', '+faststart',
      outSeg,
    ]);
    segmentPaths.push(outSeg);
  }

  // -------------------------------------------------------------------
  // 2. Concatenate all segments into the final walkthrough.
  //    Using ffmpeg's concat demuxer (all segments have identical codec
  //    parameters set above, so -c copy is safe and fast).
  // -------------------------------------------------------------------
  const listPath = path.join(SEG_DIR, '_concat-list.txt');
  const lines = segmentPaths.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
  await fs.writeFile(listPath, lines.join('\n'), 'utf8');

  console.log('\nConcatenating segments into final video...');
  await run('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    FINAL_MP4,
  ]);

  // -------------------------------------------------------------------
  // 3. Also rebuild narration.mp3 in the same reordered sequence so the
  //    standalone audio matches the video 1:1.
  // -------------------------------------------------------------------
  console.log('Rebuilding narration.mp3 in slideshow order...');
  const audioListPath = path.join(SEG_DIR, '_audio-concat-list.txt');
  const audioLines = [];
  for (const seg of SEGMENTS) {
    const cp = await chunkPath(seg.chunk);
    audioLines.push(`file '${cp.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
  }
  await fs.writeFile(audioListPath, audioLines.join('\n'), 'utf8');
  await run('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0',
    '-i', audioListPath,
    '-ar', '44100', '-ac', '2',
    '-c:a', 'libmp3lame', '-b:a', '192k',
    NARRATION_ORDERED,
  ]);

  console.log(`\n✓ Slideshow video: ${FINAL_MP4}`);
  console.log(`✓ Narration audio:  ${NARRATION_ORDERED}`);
  console.log(`  Segments: ${SEGMENTS.length}`);
}

main().catch((err) => {
  console.error('\nbuild-slideshow failed:', err.message);
  process.exit(1);
});
