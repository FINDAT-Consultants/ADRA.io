ASSURANCE REGENT v4.4.4 — NETLIFY FUNCTION DEPENDENCY BUNDLING FIX

Problem fixed:
After the v4.4.3 CommonJS entry-point repair, Netlify reported:
  Cannot find package 'serverless-http' imported from /var/task/api.cjs

Cause:
The v4.4.3 function loaded serverless-http with dynamic import(). Netlify analyzes
function source to determine which dependencies to bundle. Making serverless-http a
static CommonJS dependency is more reliable for the Lambda-compatible .cjs entry point.

Fix in v4.4.4:
1. netlify/functions/api.cjs now uses:
     const serverless = require('serverless-http');
   so Netlify can detect it as a function dependency during bundling.
2. server.js remains ESM and is still loaded with dynamic import().
3. serverless-http remains in package.json dependencies.
4. serverless-http is no longer listed as an external_node_module, allowing esbuild
   to bundle it into the deployed function artifact.
5. The Netlify build now explicitly verifies that critical runtime dependencies can
   be resolved before deployment.

GITHUB / NETLIFY DEPLOYMENT:
- Replace the old project files in the GitHub branch connected to Netlify with this build.
- Make sure netlify/functions/api.cjs is updated to the v4.4.4 version.
- Make sure netlify/functions/api.mjs does NOT exist in GitHub.
- Replace package.json and netlify.toml with the v4.4.4 versions.
- Commit the changes. Netlify will deploy automatically from GitHub.
- Keep SUPABASE_URL, SUPABASE_SECRET_KEY, and SUPABASE_STORAGE_BUCKET in Netlify
  Environment variables, not in GitHub.

After the deployment is Published, test:
  https://ar-intel.netlify.app/api/health

Expected: JSON with "ok": true.

Then sign in:
  User type: Developers - Only
  Username: Dvp
  Password: Abcd@1234
