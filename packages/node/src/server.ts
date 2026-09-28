/**
 * Cognate HTTP API Server
 *
 * Thin REST layer over pure-function governance packages.
 * Uses native node:http to keep dependencies at zero.
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

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
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
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const method = req.method ?? "GET";
    const pathname = url.pathname;

    try {
      const body = await parseBody(req);

      if (pathname === "/health" && method === "GET") {
        handleHealth(res);
        return;
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

      if (pathname.startsWith("/identity/grants/") && method === "POST") {
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
