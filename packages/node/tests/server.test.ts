import { describe, it, expect } from "vitest";
import { createServer } from "http";
import { createCognateServer } from "../src/server.js";
import { createRegistry as createModelRegistry } from "@cognate/model-registry";
import { createRegistry as createIdentityRegistry } from "@cognate/agent-identity";
import { createStore as createPromptStore } from "@cognate/prompt-store";

async function startTestServer(): Promise<{ port: number; stop: () => void }> {
  const { server } = createCognateServer({
    state: {
      registry: createModelRegistry(),
      identity: createIdentityRegistry(),
      prompts: createPromptStore(),
    },
    port: 0,
    host: "127.0.0.1",
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolve({
        port,
        stop: () => server.close(),
      });
    });
  });
}

async function fetchJson(port: number, path: string, opts?: { method?: string; body?: unknown }): Promise<{ status: number; json: unknown }> {
  const url = `http://127.0.0.1:${port}${path}`;
  const res = await fetch(url, {
    method: opts?.method ?? "GET",
    headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, json: text };
  }
}

describe("Cognate HTTP API", () => {
  it("returns health status", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/health");
      expect(status).toBe(200);
      expect((json as Record<string, unknown>).status).toBe("ok");
      expect((json as Record<string, unknown>).mode).toBe("api");
    } finally {
      stop();
    }
  });

  it("returns 404 for unknown routes", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status } = await fetchJson(port, "/unknown");
      expect(status).toBe(404);
    } finally {
      stop();
    }
  });
});
