import express from 'express';
import cors from 'cors';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve rendered videos
const OUTPUT_DIR = path.join(__dirname, 'output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
app.use('/videos', express.static(OUTPUT_DIR));

// Track render jobs
const jobs = new Map();

// Bundle the Remotion project once on startup
let bundled = null;
async function getBundled() {
  if (!bundled) {
    console.log('Bundling Remotion project...');
    bundled = await bundle({
      entryPoint: path.join(__dirname, 'src', 'index.ts'),
      webpackOverride: (config) => config,
    });
    console.log('Bundle ready.');
  }
  return bundled;
}

// Use system Chromium if available (for Docker/Render.com)
const chromiumPath = process.env.REMOTION_CHROME_EXECUTABLE || undefined;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', jobs: jobs.size });
});

// List available compositions
app.get('/compositions', async (req, res) => {
  try {
    const bundleLocation = await getBundled();
    // We have one dynamic composition
    res.json({
      compositions: ['DynamicReel'],
      status: 'ready'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start a render job
app.post('/render', async (req, res) => {
  const {
    designUrl,       // URL of the static design image
    topic,           // Text on design
    caption,         // Caption for context
    clientName,      // Client name for branding
    duration = 8,    // Duration in seconds
    style = 'auto',  // auto, zoom, pan, reveal, kinetic
    format = '9:16', // 9:16 (story/reel) or 4:5 (post)
  } = req.body;

  if (!designUrl && !topic) {
    return res.status(400).json({ error: 'Need designUrl or topic text' });
  }

  const jobId = crypto.randomUUID().slice(0, 8);
  const outputFile = path.join(OUTPUT_DIR, `reel_${jobId}.mp4`);

  jobs.set(jobId, { status: 'rendering', progress: 0, startedAt: Date.now() });

  res.json({ jobId, status: 'rendering' });

  // Render in background
  (async () => {
    try {
      const bundleLocation = await getBundled();
      const fps = 30;
      const durationInFrames = duration * fps;
      const width = 1080;
      const height = format === '9:16' ? 1920 : 1350;

      const inputProps = {
        designUrl,
        topic: topic || '',
        caption: caption || '',
        clientName: clientName || '',
        style,
        durationInFrames,
      };

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: 'DynamicReel',
        inputProps,
      });

      await renderMedia({
        composition: { ...composition, width, height, fps, durationInFrames },
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: outputFile,
        inputProps,
        chromiumOptions: chromiumPath ? { executablePath: chromiumPath } : undefined,
        onProgress: ({ progress }) => {
          const job = jobs.get(jobId);
          if (job) job.progress = Math.round(progress * 100);
        },
      });

      jobs.set(jobId, {
        status: 'done',
        progress: 100,
        videoUrl: `/videos/reel_${jobId}.mp4`,
        finishedAt: Date.now(),
      });
      console.log(`[Render] Job ${jobId} complete: ${outputFile}`);
    } catch (e) {
      console.error(`[Render] Job ${jobId} failed:`, e.message);
      jobs.set(jobId, { status: 'failed', error: e.message });
    }
  })();
});

// Check job status
app.get('/render/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ jobId: req.params.jobId, ...job });
});

// Clean up old jobs (keep last 50)
setInterval(() => {
  if (jobs.size > 50) {
    const sorted = [...jobs.entries()].sort((a, b) => (a[1].finishedAt || 0) - (b[1].finishedAt || 0));
    const toRemove = sorted.slice(0, jobs.size - 50);
    for (const [id, job] of toRemove) {
      // Delete video file too
      if (job.videoUrl) {
        const file = path.join(OUTPUT_DIR, path.basename(job.videoUrl));
        fs.unlink(file, () => {});
      }
      jobs.delete(id);
    }
  }
}, 60000);

const PORT = process.env.PORT || 3100;
app.listen(PORT, async () => {
  console.log(`Remotion Render Server running on port ${PORT}`);
  // Pre-bundle on startup so first render is fast
  console.log('Pre-bundling Remotion project...');
  try {
    await getBundled();
    console.log('Pre-bundle complete — ready for renders.');
  } catch (e) {
    console.error('Pre-bundle failed:', e.message);
  }
});
