# syntax=docker/dockerfile:1

# --- Deploy: push Convex functions + set self-host env -----------------
FROM oven/bun:1.3.14 AS deploy

WORKDIR /app

COPY package.json bun.lock ./
COPY patches ./patches
RUN bun install --frozen-lockfile --ignore-scripts

COPY convex ./convex
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY docker/deploy.sh docker/generate-auth-keys.mjs ./docker/
COPY scripts/self-host-bootstrap.mjs scripts/self-host-bootstrap-cli.mjs scripts/convexFingerprint.mjs ./scripts/
RUN chmod +x /app/docker/deploy.sh

ENTRYPOINT ["/app/docker/deploy.sh"]

# --- Web: install + build in ONE full image (same glibc / native deps) -
# Copying node_modules from oven/bun into node:*-slim often SIGABRTs
# Rolldown/Vite+ native bindings (exit 134) even on hosts with plenty of RAM.
FROM node:22-bookworm AS web-build

RUN npm install -g bun@1.3.14 \
  && apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
COPY patches ./patches
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .

ARG VITE_CONVEX_URL=http://localhost:3210
ARG VITE_CONVEX_SITE_URL=http://localhost:3211
ARG VITE_AUTH_PASSWORD_ENABLED=true
ARG VITE_SELF_HOSTED=true
# 0.0.0 / empty → resolve from nearest git tag at build (see RUN below).
ARG VITE_APP_VERSION=0.0.0

ENV VITE_CONVEX_URL=$VITE_CONVEX_URL \
    VITE_CONVEX_SITE_URL=$VITE_CONVEX_SITE_URL \
    VITE_AUTH_PASSWORD_ENABLED=$VITE_AUTH_PASSWORD_ENABLED \
    VITE_SELF_HOSTED=$VITE_SELF_HOSTED \
    VITE_APP_VERSION=$VITE_APP_VERSION \
    NODE_ENV=production \
    DISABLE_REACT_COMPILER=true \
    NODE_OPTIONS=--max-old-space-size=8192 \
    UV_THREADPOOL_SIZE=2

# Resolve version without requiring users to set APP_VERSION:
# 1) explicit build-arg, 2) git tag (fetch tags for Portainer shallow clones),
# 3) committed VERSION file (works even when .git has no tags).
RUN set -eux; \
  VER="${VITE_APP_VERSION:-}"; \
  if [ -z "$VER" ] || [ "$VER" = "0.0.0" ]; then \
    if [ -d .git ]; then \
      git fetch --tags --force 2>/dev/null || true; \
      TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"; \
      if [ -z "$TAG" ]; then \
        TAG="$(git tag -l 'v*.*.*' --sort=-v:refname | head -n1 || true)"; \
      fi; \
      if [ -n "$TAG" ]; then \
        VER="${TAG#v}"; \
      fi; \
    fi; \
  fi; \
  if [ -z "$VER" ] || [ "$VER" = "0.0.0" ]; then \
    if [ -f VERSION ]; then \
      VER="$(tr -d '[:space:]' < VERSION)"; \
    fi; \
  fi; \
  export VITE_APP_VERSION="${VER:-0.0.0}"; \
  echo "Building with VITE_APP_VERSION=${VITE_APP_VERSION}"; \
  if [ "$VITE_APP_VERSION" = "0.0.0" ]; then \
    echo "WARNING: Could not resolve app version (no git tags / VERSION file). Self-host update banner will stay off." >&2; \
  fi; \
  node node_modules/vite-plus/bin/vp build

FROM nginx:1.27-alpine AS web

ARG PUBLIC_HOST=localhost
ARG PORT=3210
ARG SITE_PROXY_PORT=3211

COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY docker/self-host-env.template.js /self-host-env.template.js
COPY docker/web-entrypoint.sh /web-entrypoint.sh
COPY --from=web-build /app/dist /usr/share/nginx/html

RUN chmod +x /web-entrypoint.sh

ENV PUBLIC_HOST=$PUBLIC_HOST \
    PORT=$PORT \
    SITE_PROXY_PORT=$SITE_PROXY_PORT \
    VITE_AUTH_PASSWORD_ENABLED=true \
    VITE_SELF_HOSTED=true \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d \
    # Only substitute our host/port vars — do not touch nginx $uri etc.
    NGINX_ENVSUBST_FILTER=^(PUBLIC_HOST|PORT|SITE_PROXY_PORT)$

EXPOSE 80
ENTRYPOINT ["/web-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
