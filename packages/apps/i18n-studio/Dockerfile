# syntax=docker/dockerfile:1.7

############################
# Stage 1: install deps
############################
FROM node:24-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pin pnpm to a fixed major to keep builds reproducible without touching root
# package.json (no `packageManager` field — see openspec change
# i18n-studio-modernization).
RUN corepack enable && corepack prepare pnpm@11 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/apps/i18n-studio/package.json packages/apps/i18n-studio/
RUN pnpm install --frozen-lockfile --filter i18n-studio...

############################
# Stage 2: build + deploy
############################
FROM deps AS build
COPY packages/apps/i18n-studio packages/apps/i18n-studio
RUN pnpm -F i18n-studio build

# Produce a self-contained production directory with only `dependencies`.
# `/prod/node_modules` will not contain devDependencies, so the runtime image
# does not need pnpm or compile toolchain.
RUN pnpm -F i18n-studio deploy --prod /prod

############################
# Stage 3: runtime
############################
FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /prod /app

ENV NODE_ENV=production \
    DATABASE_FILE=/data/i18n.db \
    PORT=3000

# Ensure `/data` (sqlite volume) and `/app` are owned by the unprivileged
# `node` user shipped with the base image.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME /data
EXPOSE 3000

CMD ["node", "node_modules/@react-router/serve/dist/cli.js", "./build/server/index.js"]
