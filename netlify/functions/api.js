import serverless from 'serverless-http';
import { app, initializeAppRuntime } from '../../server.js';

// Keep both imports static. Netlify's esbuild bundler can then follow the
// complete Assurance Regent server import graph and package server.js + src/*
// into the deployed function artifact instead of leaving server.js behind.
const expressHandler = serverless(app);
let runtimePromise = null;

async function ensureRuntime() {
  if (!runtimePromise) {
    runtimePromise = initializeAppRuntime({ background: false }).catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

export async function handler(event, context) {
  try {
    await ensureRuntime();
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
