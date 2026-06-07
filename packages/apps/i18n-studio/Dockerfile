FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Use pnpm to install workspace deps
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/apps/i18n-studio/package.json packages/apps/i18n-studio/
RUN pnpm install --frozen-lockfile --filter i18n-studio...

FROM deps AS build
COPY packages/apps/i18n-studio packages/apps/i18n-studio
RUN pnpm -F i18n-studio build

FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY --from=build /app/packages/apps/i18n-studio /app
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/packages/apps/i18n-studio/node_modules /app/node_modules
ENV NODE_ENV=production
ENV DATABASE_FILE=/data/i18n.db
VOLUME /data
EXPOSE 3000
CMD ["pnpm", "start"]
