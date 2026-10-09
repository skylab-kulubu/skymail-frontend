# One image for sandbox and production: nothing environment-specific is baked
# in at build time. The container reads its settings (see .env.example) when it
# starts, from the environment Dokploy passes to it.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases .yarn/releases
RUN yarn install --immutable

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# The build's name (release.yml passes the commit SHA), Next.js's deploymentId
# (next.config.ts). Empty for a local `docker build`.
ARG SKYMAIL_BUILD_ID=""
ENV SKYMAIL_BUILD_ID=${SKYMAIL_BUILD_ID}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nextjs && adduser -S -G nextjs nextjs
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# Swarm's start-first deploy keeps the old task until this passes. /api/health
# answers from the process alone (no Keycloak, no SkyMail API). wget is
# BusyBox's, already in node:22-alpine.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --start-interval=2s --retries=3 \
  CMD wget -q -T 2 -O /dev/null http://127.0.0.1:3000/api/health || exit 1
# node is PID 1 and Next.js handles SIGTERM itself: it stops accepting
# connections, finishes the requests in flight, then exits (143). Give it a stop
# grace of at least 10 s.
CMD ["node", "server.js"]
