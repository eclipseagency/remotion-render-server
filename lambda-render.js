// Called by Python backend: node lambda-render.js start|status <args>
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';

const [,, action, ...args] = process.argv;

const FUNCTION_NAME = 'remotion-render-4-0-438-mem2048mb-disk2048mb-120sec';
const SERVE_URL = 'https://remotionlambda-useast1-jurmrwskkv.s3.us-east-1.amazonaws.com/sites/social-agent-reels/index.html';
const REGION = 'us-east-1';

async function main() {
  if (action === 'start') {
    const props = JSON.parse(args[0]);
    const result = await renderMediaOnLambda({
      region: REGION,
      functionName: FUNCTION_NAME,
      serveUrl: SERVE_URL,
      composition: 'DynamicReel',
      codec: 'h264',
      imageFormat: 'jpeg',
      inputProps: props,
      privacy: 'public',
      framesPerLambda: 120,
    });
    console.log(JSON.stringify({ renderId: result.renderId, bucketName: result.bucketName }));

  } else if (action === 'status') {
    const renderId = args[0];
    const bucketName = args[1];
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      region: REGION,
      functionName: FUNCTION_NAME,
    });
    console.log(JSON.stringify({
      done: progress.done,
      progress: progress.overallProgress,
      outputFile: progress.outputFile,
      fatalError: progress.fatalErrorEncountered,
      errors: progress.errors?.map(e => e.message || String(e)) || [],
    }));
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
