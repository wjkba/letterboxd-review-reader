# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the Nitro (node-server preset) output
#
# Node 24 is required here (not 20): @tanstack/react-start 1.168 declares
# engines node >= 22.12, better-sqlite3 13 declares >= 22.
#
# The full (non-slim) image is used because better-sqlite3's binding.gyp
# prebuild check may run node-gyp during dependency install, which needs
# python3/make even when it ends up being a no-op (the linux-x64 glibc
# prebuild ships in the npm tarball and is used at runtime).
# ---------------------------------------------------------------------------
FROM node:24 AS build
WORKDIR /app

# pnpm version is pinned via the "packageManager" field in package.json.
# COREPACK_ENABLE_DOWNLOAD_PROMPT=0 skips corepack's interactive download
# confirmation during image build.
RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Install dependencies first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ---------------------------------------------------------------------------
# Stage 2: minimal runtime
#
# Debian/glibc base (not alpine/musl) because the better-sqlite3 linux-x64
# prebuild targets glibc. Nitro traces its external native modules into
# .output/server/node_modules (better-sqlite3 + tslib), so copying just
# .output is sufficient at runtime — no node_modules install needed.
# ---------------------------------------------------------------------------
FROM node:24-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/letterboxd.db

COPY --from=build /app/.output ./.output
# Drizzle migrations, applied automatically on server startup (see
# src/db/index.ts -> migrate()). The app runs from /app, so ./drizzle
# resolves here.
COPY --from=build /app/drizzle ./drizzle

RUN mkdir -p /data
VOLUME /data

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
