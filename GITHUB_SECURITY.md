# GitHub deployment security

This build deliberately packs browser-facing HTML/CSS/JavaScript into symbol-encoded `.arc` assets and adds keyboard/context-menu deterrents. These measures raise the cost of casual copying but **cannot make browser code impossible to recover**. A browser must be able to decode any code it executes.

## Recommended repository model

1. Use a **private GitHub repository** for the complete application. A public repository exposes server-side JavaScript and business logic regardless of browser protections.
2. Never commit `.env` or production secrets. This repository ignores environment files except `.env.example`.
3. Set `NODE_ENV=production` and define a strong `DEVELOPER_BOOTSTRAP_PASSWORD` in the deployment platform's secret manager. The production server refuses to start without it.
4. Keep `OPENAI_API_KEY`, Supabase service credentials, database secrets, signing keys, and administrator credentials only in deployment secrets.
5. Publish only deployment/build artifacts if a public repository is required.

## What the browser protection blocks/deters

- right-click context menu
- copy/cut and drag extraction
- Ctrl/Cmd+S, Ctrl/Cmd+U, Ctrl/Cmd+C/X/P
- F12 and common Ctrl/Cmd+Shift developer-tool shortcuts
- ordinary printing
- casual source reading through packed Unicode-symbol assets
- common docked DevTools inspection through a protective curtain heuristic

These controls are deterrents, not a cryptographic DRM boundary. Skilled users can still use network capture, browser automation, modified browsers, disabled JavaScript, or repository access.
