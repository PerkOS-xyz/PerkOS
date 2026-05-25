# syntax=docker/dockerfile:1.7
# Multi-stage build for the PerkOS MiniApp (Next.js 16 standalone).
#
# Stage 1 (deps):  install full deps (incl. dev) for the build step
# Stage 2 (build): run `next build` → produces .next/standalone
# Stage 3 (run):   tiny runtime image (~150 MB) running server.js

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time NEXT_PUBLIC_* env vars are baked into the static bundle.
# Pass them via --build-arg if you need them in a self-hosted image.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_PERKOS_CHAT_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ARG NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS
ARG NEXT_PUBLIC_RECEIPT_ANCHOR_CHAIN_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_PERKOS_CHAT_URL=$NEXT_PUBLIC_PERKOS_CHAT_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID \
    NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS=$NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS \
    NEXT_PUBLIC_RECEIPT_ANCHOR_CHAIN_ID=$NEXT_PUBLIC_RECEIPT_ANCHOR_CHAIN_ID
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# `standalone` output includes a self-contained server.js + node_modules slice.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Provisioning worker — a separate process that doesn't run as part of
# the Next.js server. We ship the TypeScript source + tsx so the same
# image can be started with `tsx app/worker/provisioner.ts` (used by
# the miniapp-worker docker-compose service).
#
# Next.js standalone trace only includes deps reachable from a route.
# After the launch route was refactored to enqueue jobs (PR #55), the
# AWS SDK packages and `server-only` dropped out of the trace because
# nothing in the route graph imports them directly anymore. The worker
# still needs them at runtime, so we install / shim them here.
#
# `server-only`'s real index.js throws unless the resolver picks the
# `react-server` export condition (Next sets it; tsx doesn't), so we
# ship a no-op shim — the worker is unambiguously server-side and the
# client-import check is meaningless here.
RUN npm install -g tsx@4 \
 && cd /app && npm install --omit=dev --no-save --no-audit --no-fund \
      @aws-sdk/client-ecs \
      @aws-sdk/client-secrets-manager \
 && mkdir -p /app/node_modules/server-only \
 && printf 'module.exports = {};\n' > /app/node_modules/server-only/index.js \
 && printf '{"name":"server-only","version":"0.0.0-worker-shim","main":"index.js"}\n' \
      > /app/node_modules/server-only/package.json
COPY --from=build /app/app/worker ./app/worker
COPY --from=build /app/app/lib ./app/lib
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
