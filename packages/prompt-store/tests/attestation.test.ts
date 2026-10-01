import { describe, expect, it } from "vitest";
import { createStore } from "../src/store.js";
import { attestLogPrompt, attestLogOutput } from "../src/attestation.js";
import type { Prompt, Output } from "@cognate/types";

const basePrompt: Prompt = {
  id: "p1",
  tenantId: "tenant-1",
  sessionId: "session-1",
  modelVersionId: "v1",
  policyVersion: 1,
  agentId: null,
  plaintextHash: "hash1",
  ciphertext: "encrypted-payload",
  metadata: {
    tokensIn: 10,
    systemPromptHash: null,
    temperature: 0.7,
    topP: null,
    tags: [],
  },
  submittedAt: "2026-09-28T12:00:00Z",
};

const baseOutput: Output = {
  id: "o1",
  tenantId: "tenant-1",
  promptId: "p1",
  modelVersionId: "v1",
  plaintextHash: "hash2",
  ciphertext: "encrypted-output",
  metadata: {
    tokensOut: 20,
    latencyMs: 150,
    finishReason: "stop",
    confidence: null,
  },
  generatedAt: "2026-09-28T12:01:00Z",
};

describe("attestia prompt log", () => {
  it("logs a prompt and appends an event", async () => {
    const appended: unknown[] = [];
    const state = createStore();
    const result = await attestLogPrompt(state, {
      tenantId: "tenant-1",
      eventStore: {
        async append(streamId, event) {
          appended.push(streamId, event);
        },
      },
    }, basePrompt);

    expect(result.ok).toBe(true);
    expect(appended[0]).toBe("cognate-tenant-1-prompts");
    const ev = (appended[1] as Array<{ type: string; metadata: { source: string } }>)[0];
    expect(ev.type).toBe("cognate.prompt.logged");
    expect(ev.metadata.source).toBe("external");
  });

  it("uses a custom stream prefix", async () => {
    const ids: string[] = [];
    const state = createStore();
    await attestLogPrompt(state, {
      tenantId: "tenant-1",
      streamPrefix: "lab",
      eventStore: {
        async append(streamId) {
          ids.push(streamId as string);
        },
      },
    }, basePrompt);
    expect(ids).toEqual(["lab-tenant-1-prompts"]);
  });

  it("returns error when event store append fails", async () => {
    const state = createStore();
    const result = await attestLogPrompt(state, {
      tenantId: "tenant-1",
      eventStore: {
        async append() {
          throw new Error("store down");
        },
      },
    }, basePrompt);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("attestia.append-failed");
  });

  it("returns store error when duplicate prompt", async () => {
    let state = createStore();
    state = (await attestLogPrompt(state, {
      tenantId: "tenant-1",
      eventStore: { async append() {} },
    }, basePrompt)).state!;

    const result = await attestLogPrompt(state, {
      tenantId: "tenant-1",
      eventStore: { async append() {} },
    }, basePrompt);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("store.duplicate-prompt");
  });

  it("logs an output and appends an event", async () => {
    const appended: unknown[] = [];
    let state = createStore();
    state = (await attestLogPrompt(state, {
      tenantId: "tenant-1",
      eventStore: { async append() {} },
    }, basePrompt)).state!;

    const result = await attestLogOutput(state, {
      tenantId: "tenant-1",
      eventStore: {
        async append(streamId, event) {
          appended.push(streamId, event);
        },
      },
    }, baseOutput);

    expect(result.ok).toBe(true);
    expect(appended[0]).toBe("cognate-tenant-1-outputs");
    const ev = (appended[1] as Array<{ type: string; metadata: { source: string } }>)[0];
    expect(ev.type).toBe("cognate.output.logged");
    expect(ev.metadata.source).toBe("external");
  });

  it("returns store error when output prompt not found", async () => {
    const state = createStore();
    const result = await attestLogOutput(state, {
      tenantId: "tenant-1",
      eventStore: { async append() {} },
    }, baseOutput);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("store.prompt-not-found");
  });
});
