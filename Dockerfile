# ────────────────────────────────────────────────────────────
# Stage 1: Build
# ────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /build

# Copy everything except ignored paths
COPY . .

# Install all dependencies (no frozen lockfile — workspace packages change)
RUN pnpm install

# Build workspace packages in dependency order
RUN pnpm --filter "@cognate/types" build && \
    pnpm --filter "@cognate/policy" build && \
    pnpm --filter "@cognate/model-registry" build && \
    pnpm --filter "@cognate/agent-identity" build && \
    pnpm --filter "@cognate/prompt-store" build && \
    pnpm --filter "@cognate/node" build && \
    pnpm --filter "cognate" build

# ────────────────────────────────────────────────────────────
# Stage 2: Production
# ────────────────────────────────────────────────────────────
FROM node:22-slim AS production

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app

# Copy workspace root and package manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json ./

# Copy all package.json files
COPY packages/types/package.json packages/types/
COPY packages/policy/package.json packages/policy/
COPY packages/model-registry/package.json packages/model-registry/
COPY packages/agent-identity/package.json packages/agent-identity/
COPY packages/prompt-store/package.json packages/prompt-store/
COPY packages/node/package.json packages/node/
COPY packages/cognate/package.json packages/cognate/

# Install production dependencies only
RUN pnpm install --prod

# Create data directory for persistent volumes
RUN mkdir -p /app/data

# Copy built output from builder
COPY --from=builder /build/packages/types/dist packages/types/dist
COPY --from=builder /build/packages/policy/dist packages/policy/dist
COPY --from=builder /build/packages/model-registry/dist packages/model-registry/dist
COPY --from=builder /build/packages/agent-identity/dist packages/agent-identity/dist
COPY --from=builder /build/packages/prompt-store/dist packages/prompt-store/dist
COPY --from=builder /build/packages/node/dist packages/node/dist
COPY --from=builder /build/packages/cognate/dist packages/cognate/dist

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["node", "packages/node/dist/index.js"]
