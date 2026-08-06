#!/usr/bin/env bash
set -euo pipefail

# Thin wrapper around shared bootstrap (also used by Electron).
ADMIN_KEY_FILE="/convex/data/admin_key"
DATA_DIR="/convex/data"
PUBLIC_HOST="${PUBLIC_HOST:-localhost}"
WEB_PORT="${WEB_PORT:-8088}"
SITE_URL="http://${PUBLIC_HOST}:${WEB_PORT}"
CONVEX_SELF_HOSTED_URL="${CONVEX_SELF_HOSTED_URL:-http://backend:3210}"

export CONVEX_SELF_HOSTED_URL

cd /app
exec bun scripts/self-host-bootstrap-cli.mjs \
  --convex-url "${CONVEX_SELF_HOSTED_URL}" \
  --admin-key-file "${ADMIN_KEY_FILE}" \
  --data-dir "${DATA_DIR}" \
  --site-url "${SITE_URL}" \
  --project-dir /app \
  --app-version "${APP_VERSION:-0.0.0}"
