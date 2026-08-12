import serverless from 'serverless-http';
import { withLambda } from '@netlify/aws-lambda-compat';
import { app, initializeAppRuntime } from '../../server.js';

// Assurance Regent is ESM end-to-end. Keeping this Netlify entry as .mjs
// makes esbuild emit an ESM function bundle, which is required because the
// application uses import.meta and top-level await.
const expressHandler = serverless(app);
let runtimePromise = null;

async function assuranceRegentLambdaHandler(event, context) {
  try {
    if (!runtimePromise) {
      runtimePromise = initializeAppRuntime({ background: false }).catch((error) => {
        runtimePromise = null;
        throw error;
      });
    }

    await runtimePromise;
    return await expressHandler(event, context);
  } catch (error) {
    console.error('Assurance Regent Netlify Function initialization failed:', error);
    return {
      statusCode: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
      body: JSON.stringify({
        error: error?.message || 'Assurance Regent server initialization failed.',
      }),
    };
  }
}

// Netlify's current Functions runtime uses a default-export Request/Response
// handler. withLambda adapts the serverless-http Lambda-style Express handler
// to that modern runtime without converting the application back to CJS.
export default withLambda(assuranceRegentLambdaHandler);
