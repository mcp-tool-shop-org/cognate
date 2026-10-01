# Cognate governance API.
# The process stays root, matching Attestia's server image, so the /app/data
# volume is writable. RepoMesh's image is a CLI and runs as the node user.
# ATTESTIA_EVENTS_FILE is this container's log on its own volume. Attestia
# uses the same variable on the attestia-data volume. Do not point both
# processes at one file: the log lock fails closed.

# Stage 1: Build
# -------------------------------
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /build

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json ./

COPY packages/types/package.json packages/types/
COPY packages/policy/package.json packages/policy/
COPY packages/model-registry/package.json packages/model-registry/
COPY packages/agent-identity/package.json packages/agent-identity/
COPY packages/prompt-store/package.json packages/prompt-store/
COPY packages/repomesh-bridge/package.json packages/repomesh-bridge/
COPY packages/node/package.json packages/node/
COPY packages/cognate/package.json packages/cognate/

COPY packages/ packages/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter "@cognate/types" build && \
    pnpm --filter "@cognate/policy" build && \
    pnpm --filter "@cognate/model-registry" build && \
    pnpm --filter "@cognate/agent-identity" build && \
    pnpm --filter "@cognate/prompt-store" build && \
    pnpm --filter "@cognate/repomesh-bridge" build && \
    pnpm --filter "@cognate/node" build && \
    pnpm --filter "cognate" build

# Stage 2: Production
# -------------------------------
FROM node:22-slim AS production

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json ./

COPY packages/types/package.json packages/types/
COPY packages/policy/package.json packages/policy/
COPY packages/model-registry/package.json packages/model-registry/
COPY packages/agent-identity/package.json packages/agent-identity/
COPY packages/prompt-store/package.json packages/prompt-store/
COPY packages/repomesh-bridge/package.json packages/repomesh-bridge/
COPY packages/node/package.json packages/node/
COPY packages/cognate/package.json packages/cognate/

RUN pnpm install --frozen-lockfile --prod

RUN mkdir -p /app/data/cognate

COPY --from=builder /build/packages/types/dist packages/types/dist
COPY --from=builder /build/packages/policy/dist packages/policy/dist
COPY --from=builder /build/packages/model-registry/dist packages/model-registry/dist
COPY --from=builder /build/packages/agent-identity/dist packages/agent-identity/dist
COPY --from=builder /build/packages/prompt-store/dist packages/prompt-store/dist
COPY --from=builder /build/packages/repomesh-bridge/dist packages/repomesh-bridge/dist
COPY --from=builder /build/packages/node/dist packages/node/dist
COPY --from=builder /build/packages/cognate/dist packages/cognate/dist

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV COGNATE_DATA_DIR=/app/data
ENV ATTESTIA_EVENTS_FILE=/app/data/events.jsonl
ENV COGNATE_MODEL_REGISTRY_PATH=/app/data/cognate/registry.json
ENV COGNATE_AGENT_REGISTRY_PATH=/app/data/cognate/agents.json
ENV COGNATE_PROMPT_STORE_PATH=/app/data/cognate/prompts.json
ENV REPOMESH_FAIL_ON=unverified

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["node", "packages/node/dist/index.js"]
