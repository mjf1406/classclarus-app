#!/bin/sh
set -eu

PUBLIC_HOST="${PUBLIC_HOST:-localhost}"
PORT="${PORT:-3210}"
SITE_PROXY_PORT="${SITE_PROXY_PORT:-3211}"

export PUBLIC_HOST PORT SITE_PROXY_PORT
export VITE_CONVEX_URL="http://${PUBLIC_HOST}:${PORT}"
export VITE_CONVEX_SITE_URL="http://${PUBLIC_HOST}:${SITE_PROXY_PORT}"
export VITE_AUTH_PASSWORD_ENABLED="${VITE_AUTH_PASSWORD_ENABLED:-true}"
export VITE_CLASS_PRESENCE_ENABLED="${CLASS_PRESENCE_ENABLED:-true}"
export VITE_SELF_HOSTED="${VITE_SELF_HOSTED:-true}"

# Runtime override only when explicitly set to a real semver. Empty / 0.0.0
# leaves the field blank so the SPA falls back to the version baked at build
# (from git describe or VITE_APP_VERSION build-arg).
APP_VERSION_VALUE="${APP_VERSION:-${VITE_APP_VERSION:-}}"
case "$APP_VERSION_VALUE" in
"" | "0.0.0" | "docker")
  export VITE_APP_VERSION=""
  ;;
*)
  export VITE_APP_VERSION="$APP_VERSION_VALUE"
  ;;
esac

envsubst '${VITE_CONVEX_URL} ${VITE_CONVEX_SITE_URL} ${VITE_AUTH_PASSWORD_ENABLED} ${VITE_CLASS_PRESENCE_ENABLED} ${VITE_SELF_HOSTED} ${VITE_APP_VERSION}' \
  < /self-host-env.template.js \
  > /usr/share/nginx/html/self-host-env.js

exec /docker-entrypoint.sh "$@"
