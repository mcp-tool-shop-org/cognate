# ────────────────────────────────────────────────────────────
# Stage 1: Build
# ────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /build

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json ./

# Copy all package.json files for workspace resolution
COPY packages/types/package.json packages/types/
COPY packages/policy/package.json packages/policy/
COPY packages/model-registry/package.json packages/model-registry/
COPY packages/agent-identity/package.json packages/agent-identity/
COPY packages/prompt-store/package.json packages/prompt-store/

# Install all dependencies. Dev dependencies stay in this stage so tsc resolves.
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY packages/ packages/

# Build all packages
RUN pnpm -r build

# ────────────────────────────────────────────────────────────
# Stage 2: Production
# ────────────────────────────────────────────────────────────
FROM node:22-slim AS production

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json ./

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/policy/package.json packages/policy/
COPY packages/model-registry/package.json packages/model-registry/
COPY packages/agent-identity/package.json packages/agent-identity/
COPY packages/prompt-store/package.json packages/prompt-store/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

RUN mkdir -p /app/data

COPY scripts/health-server.mjs scripts/health-server.mjs

# Copy built output from builder
COPY --from=builder /build/packages/types/dist packages/types/dist
COPY --from=builder /build/packages/policy/dist packages/policy/dist
COPY --from=builder /build/packages/model-registry/dist packages/model-registry/dist
COPY --from=builder /build/packages/agent-identity/dist packages/agent-identity/dist
COPY --from=builder /build/packages/prompt-store/dist packages/prompt-store/dist

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["node", "scripts/health-server.mjs"]
