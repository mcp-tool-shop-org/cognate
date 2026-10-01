import { describe, expect, it } from "vitest";
import { createCognateServer, type ServerState } from "../src/server.js";
import { parseReleaseFailOn, releaseAccepted, releaseConfigFromEnv } from "../src/release-gate.js";
import {
  createRegistry as createModelRegistry,
  registerModel,
  registerVersion,
  transitionVersion,
} from "@cognate/model-registry";
import { createRegistry as createIdentityRegistry, registerAgent } from "@cognate/agent-identity";
import { createStore as createPromptStore } from "@cognate/prompt-store";

const TEST_TIMESTAMP = "2026-09-28T12:00:00Z";

const model = {
  id: "m1",
  tenantId: "tenant-1",
  name: "Test Model",
  description: "A test model",
  architecture: "transformer",
  createdAt: TEST_TIMESTAMP,
  owner: "human-1",
  currentVersion: null,
  status: "active" as const,
};

const version = {
  id: "v1",
  modelId: "m1",
  tenantId: "tenant-1",
  versionNumber: 1,
  weightsHash: "w1",
  configHash: "c1",
  manifestHash: "mf1",
  datasetRefs: [],
  createdAt: TEST_TIMESTAMP,
  status: "registered" as const,
};

type Appended = {
  streamId: string;
  events: ReadonlyArray<{
    type?: string;
    metadata?: { source?: string; eventId?: string };
    payload?: Record<string, unknown>;
  }>;
};

function recordingStore() {
  const appended: Appended[] = [];
  return {
    appended,
    eventStore: {
      append(streamId: string, events: Appended["events"]) {
        appended.push({ streamId, events });
        return { streamId, fromVersion: 1, toVersion: events.length, count: events.length };
      },
    },
  };
}

function emptyState(agentId: string): ServerState {
  let identity = createIdentityRegistry();
  const regResult = registerAgent(identity, {
    id: agentId,
    tenantId: "tenant-1",
    name: "Test Agent",
    owner: "human-1",
    walletAddress: null,
    publicKey: null,
    capabilities: [],
    createdAt: TEST_TIMESTAMP,
    status: "active",
  });
  if (regResult.ok) identity = regResult.state;
  return {
    registry: createModelRegistry(),
    identity,
    prompts: createPromptStore(),
  };
}

function seed(state: ServerState, to: "registered" | "approved") {
  let registry = registerModel(state.registry, model);
  registry = registerVersion(registry, version);
  if (to === "approved") {
    registry = transitionVersion(registry, "v1", "registered", "evaluated", "admin-1", "eval");
    registry = transitionVersion(registry, "v1", "evaluated", "approved", "admin-1", "approve");
  }
  state.registry = registry;
}

async function start(opts: {
  agentId: string;
  eventStore?: ReturnType<typeof recordingStore>["eventStore"];
  verifyRelease?: (repo: string, version: string) => Promise<{ status: string }>;
  releaseFailOn?: "fail" | "unverified";
}) {
  const recorded = recordingStore();
  const { server, state } = createCognateServer({
    state: emptyState(opts.agentId),
    port: 0,
    host: "127.0.0.1",
    eventStore: opts.eventStore ?? recorded.eventStore,
    ...(opts.verifyRelease ? { verifyRelease: opts.verifyRelease } : {}),
    ...(opts.releaseFailOn ? { releaseFailOn: opts.releaseFailOn } : {}),
  });
  const port = await new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(typeof addr === "object" && addr !== null ? addr.port : 0);
    });
  });
  return { port, stop: () => server.close(), recorded, state };
}

async function post(port: number, agentId: string, body: unknown) {
  const res = await fetch(`http://127.0.0.1:${port}/registry/versions/v1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Id": agentId,
      "X-Timestamp": TEST_TIMESTAMP,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

function deployBody(extra: Record<string, unknown> = {}) {
  return { from: "approved", to: "deployed", actorId: "admin-1", reason: "Ship", repo: "acme/weights", release: "1.2.3", ...extra };
}

describe("release gate decisions", () => {
  it("accepts PASS, and UNVERIFIED only when failOn is fail", () => {
    expect(releaseAccepted("PASS", "unverified")).toBe(true);
    expect(releaseAccepted("PASS", "fail")).toBe(true);
    expect(releaseAccepted("UNVERIFIED", "fail")).toBe(true);
    expect(releaseAccepted("UNVERIFIED", "unverified")).toBe(false);
    expect(releaseAccepted("FAIL", "fail")).toBe(false);
    expect(releaseAccepted("FAIL", "unverified")).toBe(false);
    expect(releaseAccepted("ERROR", "fail")).toBe(false);
    expect(releaseAccepted("", "fail")).toBe(false);
  });

  it("treats only the exact string fail as relaxed", () => {
    expect(parseReleaseFailOn("fail")).toBe("fail");
    expect(parseReleaseFailOn("FAIL")).toBe("unverified");
    expect(parseReleaseFailOn("fail ")).toBe("unverified");
    expect(parseReleaseFailOn(undefined)).toBe("unverified");
    expect(parseReleaseFailOn("")).toBe("unverified");
  });

  it("omits a blank ledger and local path, and anchors only on the exact string true", () => {
    expect(releaseConfigFromEnv({})).toEqual({ failOn: "unverified", repomesh: { anchored: false } });
    const set = releaseConfigFromEnv({
      REPOMESH_FAIL_ON: "fail",
      REPOMESH_LEDGER_URL: "  https://ledger.example/ ",
      REPOMESH_LOCAL_PATH: "  ",
      REPOMESH_ANCHORED: "true",
    });
    expect(set.failOn).toBe("fail");
    expect(set.repomesh).toEqual({ anchored: true, ledgerUrl: "https://ledger.example/" });
    expect(releaseConfigFromEnv({ REPOMESH_ANCHORED: "1", REPOMESH_LEDGER_URL: "  " }).repomesh).toEqual({
      anchored: false,
    });
  });
});

describe("HTTP deploy gate", () => {
  it("refuses a deploy that names no release and does not call RepoMesh", async () => {
    const agentId = "deploy-missing";
    const calls: string[] = [];
    const { port, stop, recorded, state } = await start({
      agentId,
      verifyRelease: async (repo) => {
        calls.push(repo);
        return { status: "PASS" };
      },
    });
    try {
      seed(state, "approved");
      const { status, json } = await post(port, agentId, deployBody({ repo: "  ", release: "" }));
      expect(status).toBe(400);
      expect(json.code).toBe("repomesh.missing-release");
      expect(calls).toEqual([]);
      expect(recorded.appended).toEqual([]);
      expect(state.registry.versions.v1?.status).toBe("approved");
    } finally {
      stop();
    }
  });

  it("records a FAIL and leaves the version approved", async () => {
    const agentId = "deploy-fail";
    const { port, stop, recorded, state } = await start({
      agentId,
      verifyRelease: async () => ({ status: "FAIL" }),
    });
    try {
      seed(state, "approved");
      const { status, json } = await post(port, agentId, deployBody());
      expect(status).toBe(409);
      expect(json.code).toBe("repomesh.release-denied");
      expect(json.status).toBe("FAIL");
      expect(json.repo).toBe("acme/weights");
      expect(json.release).toBe("1.2.3");
      expect(state.registry.versions.v1?.status).toBe("approved");
      expect(recorded.appended).toHaveLength(1);
      const event = recorded.appended[0]?.events[0];
      expect(recorded.appended[0]?.streamId).toBe("cognate-tenant-1-releases");
      expect(event?.type).toBe("cognate.release.checked");
      expect(event?.metadata?.source).toBe("external");
      expect(event?.metadata?.eventId).toBe(json.eventId);
      expect(event?.payload).toEqual({
        modelVersionId: "v1",
        repo: "acme/weights",
        release: "1.2.3",
        status: "FAIL",
        accepted: false,
      });
      expect(recorded.appended.some((entry) => entry.events.some((item) => item.type === "cognate.model.transitioned"))).toBe(false);
    } finally {
      stop();
    }
  });

  it("refuses UNVERIFIED when failOn is omitted", async () => {
    const agentId = "deploy-unverified";
    const { port, stop, state } = await start({
      agentId,
      verifyRelease: async () => ({ status: "UNVERIFIED" }),
    });
    try {
      seed(state, "approved");
      const { status, json } = await post(port, agentId, deployBody());
      expect(status).toBe(409);
      expect(json.status).toBe("UNVERIFIED");
      expect(state.registry.versions.v1?.status).toBe("approved");
    } finally {
      stop();
    }
  });

  it("deploys UNVERIFIED when failOn is fail", async () => {
    const agentId = "deploy-relaxed";
    const { port, stop, state } = await start({
      agentId,
      releaseFailOn: "fail",
      verifyRelease: async () => ({ status: "UNVERIFIED" }),
    });
    try {
      seed(state, "approved");
      const { status, json } = await post(port, agentId, deployBody());
      expect(status).toBe(200);
      expect(json.releaseStatus).toBe("UNVERIFIED");
      expect(state.registry.versions.v1?.status).toBe("deployed");
    } finally {
      stop();
    }
  });

  it("deploys a PASS and returns the transition id separately from the check id", async () => {
    const agentId = "deploy-pass";
    const { port, stop, recorded, state } = await start({
      agentId,
      verifyRelease: async () => ({ status: "PASS" }),
    });
    try {
      seed(state, "approved");
      const { status, json } = await post(port, agentId, deployBody());
      expect(status).toBe(200);
      expect(json.to).toBe("deployed");
      expect(json.releaseStatus).toBe("PASS");
      expect(state.registry.versions.v1?.status).toBe("deployed");
      expect(recorded.appended.map((entry) => entry.events[0]?.type)).toEqual([
        "cognate.release.checked",
        "cognate.model.transitioned",
      ]);
      const check = recorded.appended[0]?.events[0];
      const transition = recorded.appended[1]?.events[0];
      expect(check?.payload).toMatchObject({ accepted: true, status: "PASS" });
      expect(check?.payload).not.toHaveProperty("weightsHash");
      expect(json.releaseEventId).toBe(check?.metadata?.eventId);
      expect(json.eventId).toBe(transition?.metadata?.eventId);
      expect(json.eventId).not.toBe(json.releaseEventId);
      expect(transition?.payload).toMatchObject({ from: "approved", to: "deployed" });
    } finally {
      stop();
    }
  });

  it("returns 503 when the checker is absent and does not append", async () => {
    const agentId = "deploy-unwired";
    const { port, stop, recorded, state } = await start({ agentId });
    try {
      seed(state, "approved");
      const { status, json } = await post(port, agentId, deployBody());
      expect(status).toBe(503);
      expect(json.code).toBe("repomesh.not-configured");
      expect(recorded.appended).toEqual([]);
      expect(state.registry.versions.v1?.status).toBe("approved");
    } finally {
      stop();
    }
  });

  it("returns 503 when the checker throws and does not append", async () => {
    const agentId = "deploy-throws";
    const { port, stop, recorded, state } = await start({
      agentId,
      verifyRelease: async () => {
        throw new Error("ledger down");
      },
    });
    try {
      seed(state, "approved");
      const { status, json } = await post(port, agentId, deployBody());
      expect(status).toBe(503);
      expect(json.code).toBe("repomesh.check-failed");
      expect(json.message).toContain("ledger down");
      expect(recorded.appended).toEqual([]);
      expect(state.registry.versions.v1?.status).toBe("approved");
    } finally {
      stop();
    }
  });

  it("does not deploy when the refusal itself fails to append", async () => {
    const agentId = "deploy-append-down";
    const store = {
      append() {
        throw new Error("disk full");
      },
    };
    const { port, stop, state } = await start({
      agentId,
      eventStore: store,
      verifyRelease: async () => ({ status: "FAIL" }),
    });
    try {
      seed(state, "approved");
      const { status, json } = await post(port, agentId, deployBody());
      expect(status).toBe(503);
      expect(json.code).toBe("attestia.append-failed");
      expect(state.registry.versions.v1?.status).toBe("approved");
    } finally {
      stop();
    }
  });

  it("keeps the version approved when the transition append fails after a passing check", async () => {
    const agentId = "deploy-transition-down";
    const appended: Appended[] = [];
    const store = {
      append(streamId: string, events: Appended["events"]) {
        if (events[0]?.type === "cognate.model.transitioned") throw new Error("disk full");
        appended.push({ streamId, events });
        return { streamId, fromVersion: 1, toVersion: 1, count: 1 };
      },
    };
    const { port, stop, state } = await start({
      agentId,
      eventStore: store,
      verifyRelease: async () => ({ status: "PASS" }),
    });
    try {
      seed(state, "approved");
      const { status, json } = await post(port, agentId, deployBody());
      expect(status).toBe(503);
      expect(json.code).toBe("attestia.append-failed");
      expect(state.registry.versions.v1?.status).toBe("approved");
      expect(appended).toHaveLength(1);
      expect(appended[0]?.events[0]?.payload).toMatchObject({ accepted: true, status: "PASS" });
    } finally {
      stop();
    }
  });

  it("does not call RepoMesh for a transition that is not a deploy", async () => {
    const agentId = "deploy-skip";
    const calls: string[] = [];
    const { port, stop, recorded, state } = await start({
      agentId,
      verifyRelease: async () => {
        calls.push("called");
        throw new Error("should not run");
      },
    });
    try {
      seed(state, "registered");
      const { status, json } = await post(port, agentId, {
        from: "registered",
        to: "evaluated",
        actorId: "admin-1",
        reason: "Initial evaluation",
        repo: "acme/weights",
        release: "1.2.3",
      });
      expect(status).toBe(200);
      expect(json.to).toBe("evaluated");
      expect(json).not.toHaveProperty("releaseEventId");
      expect(json).not.toHaveProperty("releaseStatus");
      expect(calls).toEqual([]);
      expect(recorded.appended.map((entry) => entry.events[0]?.type)).toEqual(["cognate.model.transitioned"]);
    } finally {
      stop();
    }
  });

  it("does not call RepoMesh when the version does not exist", async () => {
    const agentId = "deploy-missing-version";
    const calls: string[] = [];
    const { port, stop, recorded } = await start({
      agentId,
      verifyRelease: async () => {
        calls.push("called");
        return { status: "PASS" };
      },
    });
    try {
      const { status, json } = await post(port, agentId, {
        from: "registered",
        to: "deployed",
        actorId: "admin-1",
        reason: "Skip",
        repo: "acme/weights",
        release: "1.2.3",
      });
      expect(status).toBe(400);
      expect(json.code).toBe("VERSION_NOT_FOUND");
      expect(calls).toEqual([]);
      expect(recorded.appended).toEqual([]);
    } finally {
      stop();
    }
  });

  it("does not call RepoMesh when the stored status is not approved", async () => {
    const agentId = "deploy-wrong-status";
    const calls: string[] = [];
    const { port, stop, recorded, state } = await start({
      agentId,
      verifyRelease: async () => {
        calls.push("called");
        return { status: "PASS" };
      },
    });
    try {
      seed(state, "registered");
      const { status, json } = await post(port, agentId, deployBody());
      expect(status).toBe(400);
      expect(json.code).toBe("INVALID_TRANSITION_SOURCE");
      expect(calls).toEqual([]);
      expect(recorded.appended).toEqual([]);
      expect(state.registry.versions.v1?.status).toBe("registered");
    } finally {
      stop();
    }
  });
});
