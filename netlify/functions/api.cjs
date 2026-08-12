'use strict';

// Netlify executes this entry point as CommonJS. The Assurance Regent server
// itself is ESM (package.json has "type": "module"), so it must be loaded with
// dynamic import() rather than require(). This avoids ERR_REQUIRE_ESM on Netlify.
let handlerPromise = null;

async function getExpressHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const [{ default: serverless }, serverModule] = await Promise.all([
        import('serverless-http'),
        import('../../server.js'),
      ]);

      const { app, initializeAppRuntime } = serverModule;
      await initializeAppRuntime({ background: false });
      return serverless(app);
    })().catch((error) => {
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
