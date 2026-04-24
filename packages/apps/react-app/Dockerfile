# layer: base
FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

# layer: fetch
FROM base AS fetch
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

# layer: build
FROM base AS build
COPY --from=fetch /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY . ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline
RUN pnpm --filter react-app build

# layer: prod-deps
FROM base AS prod-deps
COPY --from=fetch /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY packages/apps/react-app/package.json ./packages/apps/react-app/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --offline --filter react-app...

# layer: release
FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/packages/apps/react-app/node_modules /app/packages/apps/react-app/node_modules
COPY --from=build /app/packages/apps/react-app/build /app/packages/apps/react-app/build
WORKDIR /app/packages/apps/react-app
CMD ["pnpm", "start"]