FROM node:24.15.0-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS build

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json codegen.ts prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
COPY scripts/copy-assets.mjs ./scripts/copy-assets.mjs
RUN npm run build \
    && npm prune --omit=dev

FROM base AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/prisma ./prisma

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
