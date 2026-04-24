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

# layer: deps
FROM base AS deps
COPY . ./
RUN --mount=type=secret,id=TIPTAP_PRO_TOKEN \
    --mount=type=cache,id=pnpm,target=/pnpm/store \
    export TIPTAP_PRO_TOKEN=$(cat /run/secrets/TIPTAP_PRO_TOKEN) \
    && echo "@tiptap-pro:registry=https://registry.tiptap.dev/" > .npmrc \
    && echo "//registry.tiptap.dev/:_authToken=${TIPTAP_PRO_TOKEN}" >> .npmrc \
    && echo "registry=https://registry.npmmirror.com/" >> .npmrc \
    && pnpm install --frozen-lockfile

# layer: build
FROM deps AS build
RUN pnpm --filter artusx-api build

# layer: release
FROM base
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/apps/artusx-api/node_modules /app/packages/apps/artusx-api/node_modules
COPY --from=build /app/packages/apps/artusx-api/dist /app/packages/apps/artusx-api/dist
WORKDIR /app/packages/apps/artusx-api
EXPOSE 7001
CMD ["pnpm", "start"]