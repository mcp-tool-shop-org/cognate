/**
 * Cognate HTTP API Server
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { RegistryState } from "@cognate/model-registry";
import type { IdentityRegistryState } from "@cognate/agent-identity";
import type { PromptStoreState } from "@cognate/prompt-store";

import { handleHealth } from "./routes/health.js";
import { handlePolicy } from "./routes/policy.js";
import { handleRegistry } from "./routes/registry.js";
import { handleIdentity } from "./routes/identity.js";
import { handlePrompts } from "./routes/prompts.js";
import { authenticate } from "./middleware/auth.js";
import { checkRateLimit, createRateLimitState, type RateLimitConfig } from "./middleware/rate-limit.js";

export interface ServerState {
  registry: RegistryState;
  identity: IdentityRegistryState;
  prompts: PromptStoreState;
}

export interface ServerContext {
  readonly state: ServerState;
  readonly port: number;
  readonly host: string;
}

const rateLimitBuckets = new Map<string, ReturnType<typeof createRateLimitState>>();

const rateLimits: Record<string, RateLimitConfig> = {
  default: { maxTokens: 100, refillRate: 10 },
  "/policy/evaluate": { maxTokens: 100, refillRate: 10 },
  "/registry/models": { maxTokens: 10, refillRate: 1 },
  "/registry/versions": { maxTokens: 10, refillRate: 1 },
  "/identity/agents": { maxTokens: 10, refillRate: 1 },
  "/identity/grants": { maxTokens: 10, refillRate: 1 },
  "/prompts": { maxTokens: 1000, refillRate: 100 },
};

function getRateLimitConfig(pathname: string): { prefix: string; config: RateLimitConfig } {
  for (const [prefix, config] of Object.entries(rateLimits)) {
    if (pathname === prefix || pathname.startsWith(prefix)) return { prefix, config };
  }
  return { prefix: "default", config: rateLimits.default };
}

function checkRateLimitForAgent(agentId: string, pathname: string, nowMs: number): { allowed: boolean; retryAfter?: number } {
  const { prefix, config } = getRateLimitConfig(pathname);
  const bucketKey = agentId + ":" + prefix;
  let state = rateLimitBuckets.get(bucketKey);
  if (!state) {
    state = createRateLimitState();
    state.tokens = config.maxTokens;
    rateLimitBuckets.set(bucketKey, state);
  }
  const result = checkRateLimit(state, config, nowMs);
  if (!result.allowed) {
    const retryAfter = Math.ceil((1 - result.state.tokens) / config.refillRate);
    return { allowed: false, retryAfter };
  }
  rateLimitBuckets.set(bucketKey, result.state);
  return { allowed: true };
}

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

export function createCognateServer(ctx: ServerContext) {
  const mutableState = {
    registry: ctx.state.registry,
    identity: ctx.state.identity,
    prompts: ctx.state.prompts,
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://" + (req.headers.host ?? "localhost"));
    const method = req.method ?? "GET";
    const pathname = url.pathname;

    try {
      const body = await parseBody(req);

      if (pathname === "/health" && method === "GET") {
        handleHealth(res);
        return;
      }

      // All POST endpoints require authentication + rate limiting
      if (method === "POST") {
        const authResult = authenticate(req, { identityState: mutableState.identity });
        if (!authResult.ok) {
          sendJson(res, 401, { error: authResult.code, message: authResult.message });
          return;
        }
        const agentId = authResult.agent.agentId;
        const rateResult = checkRateLimitForAgent(agentId, pathname, Date.now());
        if (!rateResult.allowed) {
          res.writeHead(429, {
            "Content-Type": "application/json",
            "Retry-After": String(rateResult.retryAfter ?? 60),
          });
          res.end(JSON.stringify({ error: "rate-limit.exceeded", message: "Rate limit exceeded", retryAfter: rateResult.retryAfter }));
          return;
        }
      }

      if (pathname === "/policy/evaluate" && method === "POST") {
        await handlePolicy(res, body);
        return;
      }

      if (pathname === "/registry/models" && method === "POST") {
        const result = handleRegistry(mutableState, pathname, method, body);
        mutableState.registry = result.state ?? mutableState.registry;
        sendJson(res, result.ok ? 200 : 400, result.ok ? result.value : result.error);
        return;
      }

      if (pathname.startsWith("/registry/versions/") && method === "POST") {
        const result = handleRegistry(mutableState, pathname, method, body);
        mutableState.registry = result.state ?? mutableState.registry;
        sendJson(res, result.ok ? 200 : 400, result.ok ? result.value : result.error);
        return;
      }

      if (pathname === "/identity/agents" && method === "POST") {
        const result = handleIdentity(mutableState, pathname, method, body);
        mutableState.identity = result.state ?? mutableState.identity;
        sendJson(res, result.ok ? 201 : 400, result.ok ? result.value : result.error);
        return;
      }

      if ((pathname === "/identity/grants" || pathname.startsWith("/identity/grants/")) && method === "POST") {
        const result = handleIdentity(mutableState, pathname, method, body);
        mutableState.identity = result.state ?? mutableState.identity;
        sendJson(res, result.ok ? 200 : 400, result.ok ? result.value : result.error);
        return;
      }

      if (pathname === "/prompts" && method === "POST") {
        const result = handlePrompts(mutableState, pathname, method, body);
        mutableState.prompts = result.state ?? mutableState.prompts;
        sendJson(res, result.ok ? 201 : 400, result.ok ? result.value : result.error);
        return;
      }

      if (pathname.startsWith("/prompts/") && pathname.endsWith("/outputs") && method === "POST") {
        const result = handlePrompts(mutableState, pathname, method, body);
        mutableState.prompts = result.state ?? mutableState.prompts;
        sendJson(res, result.ok ? 201 : 400, result.ok ? result.value : result.error);
        return;
      }

      sendJson(res, 404, { error: "Not found", path: pathname, method });
    } catch (err) {
      sendJson(res, 500, {
        error: "Internal server error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return { server, state: mutableState };
}
