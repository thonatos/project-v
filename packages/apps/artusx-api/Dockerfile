# layer: base
FROM node:20 AS base

ENV TIME_ZONE=Asia/Shanghai
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN \
  apt update \
  && apt install -y tzdata \
  && echo "${TIME_ZONE}" > /etc/timezone \
  && ln -sf /usr/share/zoneinfo/${TIME_ZONE} /etc/localtime \
  && corepack enable

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
RUN pnpm --filter artusx-api build

# layer: prod-deps
FROM base AS prod-deps
COPY --from=fetch /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY packages/apps/artusx-api/package.json ./packages/apps/artusx-api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --offline --filter artusx-api...

# layer: release
FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/packages/apps/artusx-api/node_modules /app/packages/apps/artusx-api/node_modules
COPY --from=build /app/packages/apps/artusx-api/dist /app/packages/apps/artusx-api/dist
WORKDIR /app/packages/apps/artusx-api
EXPOSE 7001
CMD ["pnpm", "start"]