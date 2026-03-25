import express from 'express';
import cors from 'cors';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set AWS credentials for Remotion Lambda SDK
process.env.REMOTION_AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
process.env.REMOTION_AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const FUNCTION_NAME = 'remotion-render-4-0-438-mem2048mb-disk2048mb-240sec';
const SERVE_URL = 'https://remotionlambda-useast1-jurmrwskkv.s3.us-east-1.amazonaws.com/sites/social-agent-reels/index.html';
const REGION = 'us-east-1';

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Start a render on Lambda
app.post('/render', async (req, res) => {
  const { designUrl, topic, caption, clientName, duration = 5, style = 'auto', format = '9:16' } = req.body;

  if (!designUrl && !topic) {
    return res.status(400).json({ error: 'Need designUrl or topic' });
  }

  try {
    const fps = 30;
    const durationInFrames = duration * fps;

    const result = await renderMediaOnLambda({
      region: REGION,
      functionName: FUNCTION_NAME,
      serveUrl: SERVE_URL,
      composition: 'DynamicReel',
      codec: 'h264',
      imageFormat: 'jpeg',
      inputProps: {
        designUrl: designUrl || '',
        topic: topic || '',
        caption: caption || '',
        clientName: clientName || '',
        style,
        durationInFrames,
      },
      privacy: 'public',
      framesPerLambda: Math.max(durationInFrames, 90), // 1 chunk to avoid concurrency
    });

    res.json({ jobId: result.renderId, bucketName: result.bucketName, status: 'rendering' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Check render progress
app.get('/render/:renderId', async (req, res) => {
  const { renderId } = req.params;
  const bucket = req.query.bucket || 'remotionlambda-useast1-jurmrwskkv';

  try {
    const p = await getRenderProgress({
      renderId,
      bucketName: bucket,
      region: REGION,
      functionName: FUNCTION_NAME,
    });

    if (p.done && p.outputFile) {
      return res.json({ status: 'done', progress: 100, videoUrl: p.outputFile });
    }
    if (p.fatalErrorEncountered) {
      return res.json({ status: 'failed', error: p.errors?.[0]?.message || 'Render failed' });
    }

    res.json({ status: 'rendering', progress: Math.round(p.overallProgress * 100) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => console.log(`Lambda bridge running on port ${PORT}`));
