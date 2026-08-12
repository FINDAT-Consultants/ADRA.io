'use strict';

// Netlify runs this entry point as CommonJS. Keep serverless-http as a
// static dependency so Netlify's function bundler can detect and include it.
// The Assurance Regent application itself remains ESM, so server.js is loaded
// with dynamic import().
const serverless = require('serverless-http');

let handlerPromise = null;

async function getExpressHandler() {
  if (!handlerPromise) {
    handlerPromise = import('../../server.js')
      .then(async ({ app, initializeAppRuntime }) => {
        await initializeAppRuntime({ background: false });
        return serverless(app);
      })
      .catch((error) => {
        handlerPromise = null;
        throw error;
      });
  }
  return handlerPromise;
}

exports.handler = async function handler(event, context) {
  try {
    const expressHandler = await getExpressHandler();
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
        error: error && error.message
          ? error.message
          : 'Assurance Regent server initialization failed.',
      }),
    };
  }
};
