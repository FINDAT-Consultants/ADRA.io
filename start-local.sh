#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Edit .env and set a fresh OPENAI_API_KEY, then run this script again."
  exit 1
fi
KEY="$(sed -n 's/^OPENAI_API_KEY=//p' .env | head -n 1)"
if [ -z "$KEY" ]; then
  echo "OPENAI_API_KEY is empty in .env. Add a fresh server-side project key first."
  exit 1
fi
if [ ! -d node_modules ]; then npm install; fi
( sleep 2; command -v xdg-open >/dev/null 2>&1 && xdg-open http://localhost:3000 >/dev/null 2>&1 || command -v open >/dev/null 2>&1 && open http://localhost:3000 >/dev/null 2>&1 || true ) &
npm start
