import { createHash, createPrivateKey, createPublicKey, randomBytes, sign } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent, CapabilityGrant, Model, ModelVersion } from "@cognate/types";
import {
  createRegistry as createIdentityRegistry,
  registerAgent,
  type IdentityState,
} from "@cognate/agent-identity";
import { createRegistry as createModelRegistry } from "@cognate/model-registry";
import { createStore as createPromptStore } from "@cognate/prompt-store";
import { createCognateServer, type ServerContext } from "../src/server.js";
import { TEST_ONLY_TENANT_ROOTS, TEST_ONLY_TENANT_ROOTS_PATH } from "./fixtures/test-only-tenant-roots.js";

const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

interface TestKeyPair {
  readonly seedHex: string;
  readonly publicKey: string;
  readonly kid: string;
}

function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

function makeKeyPairFromSeedHex(seedHex: string): TestKeyPair {
  const seed = Buffer.from(seedHex, "hex");
  const privKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  const pubDer = createPublicKey(privKey).export({ format: "der", type: "spki" }) as Buffer;
  const rawPub = pubDer.subarray(ED25519_SPKI_PREFIX.length);
  const publicKey = rawPub.toString("base64url");
  const kid = sha256Hex(rawPub);
  return { seedHex, publicKey, kid };
}

function makeDeterministicKeyPair(label: string): TestKeyPair {
  return makeKeyPairFromSeedHex(sha256Hex(`cognate-test-key:${label}`));
}

function buildCanonicalRequest(params: {
  method: string;
  path: string;
  bodyBytes: Uint8Array;
  timestamp: string;
  nonce: string;
  agentId: string;
  kid: string;
}): string {
  const bodySha256 = sha256Hex(params.bodyBytes);
  return [
    "cognate-request-v1",
    params.method,
    params.path,
    bodySha256,
    params.timestamp,
    params.nonce,
    params.agentId,
    params.kid,
  ].join("\n");
}

function signCanonicalString(canonical: string, seedHex: string): string {
  const seed = Buffer.from(seedHex, "hex");
  const privKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  return sign(null, Buffer.from(canonical, "utf8"), privKey).toString("base64url");
}

function jcsStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => jcsStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${jcsStringify(obj[k])}`).join(",")}}`;
}

function makeSignedRequestInit(params: {
  method: "GET" | "POST";
  path: string;
  agentId: string;
  keyPair: TestKeyPair;
  body?: unknown;
  rawBodyOverride?: string;
  timestamp?: string;
  nonce?: string;
  headerOverrides?: Record<string, string>;
}): { path: string; init: RequestInit; rawBody: string; nonce: string; timestamp: string } {
  const timestamp = params.timestamp ?? new Date().toISOString();
  const nonce = params.nonce ?? randomBytes(16).toString("base64url");
  const rawBody =
    params.rawBodyOverride !== undefined
      ? params.rawBodyOverride
      : params.method === "POST"
        ? jcsStringify(params.body ?? {})
        : "";
  const bodyBytes = Buffer.from(rawBody, "utf8");
  const canonical = buildCanonicalRequest({
    method: params.method,
    path: params.path,
    bodyBytes,
    timestamp,
    nonce,
    agentId: params.agentId,
    kid: params.keyPair.kid,
  });
  const signature = signCanonicalString(canonical, params.keyPair.seedHex);
  const headers: Record<string, string> = {
    "X-Agent-Id": params.agentId,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Key-Id": params.keyPair.kid,
    "X-Signature": signature,
    ...(params.method === "POST" ? { "Content-Type": "application/json" } : {}),
    ...(params.headerOverrides ?? {}),
  };
  return {
    path: params.path,
    rawBody,
    nonce,
    timestamp,
    init: {
      method: params.method,
      headers,
      ...(params.method === "POST" ? { body: rawBody } : {}),
    },
  };
}

function createFakeEventStore() {
  const events: Array<Record<string, unknown>> = [];
  return {
    events,
    store: {
      append(streamId: string, eventList: ReadonlyArray<Record<string, unknown>>) {
        for (const ev of eventList) {
          events.push({ streamId, ...ev });
        }
        return { streamId, fromVersion: 1, toVersion: eventList.length, count: eventList.length };
      },
      readAll() {
        return [...events];
      },
    },
  };
}

const TENANT = "tenant-a";
const ROOT_ACTOR_ID = `sha256:${sha256Hex(`cognate-tenant-root:${TENANT}`)}`;
const ROOT_KEY = makeKeyPairFromSeedHex(sha256Hex(`cognate-test-root-seed:${TENANT}`));

function seedAgentRecord(
  id: string,
  keyPair: TestKeyPair,
  opts?: {
    tenantId?: string;
    owner?: string;
    principal?: "human" | "agent";
    capabilities?: Agent["capabilities"];
    status?: Agent["status"];
    revokedKids?: readonly string[];
  },
): Agent {
  return {
    id,
    tenantId: opts?.tenantId ?? TENANT,
    name: `sha256:${sha256Hex(`agent-name:${id}`)}`,
    owner: opts?.owner ?? `sha256:${sha256Hex(`owner:${id}`)}`,
    walletAddress: null,
    publicKey: keyPair.publicKey,
    capabilities: opts?.capabilities ?? [],
    createdAt: "2026-10-24T12:00:00Z",
    status: opts?.status ?? "active",
    ...(opts?.principal ? { principal: opts.principal } : {}),
    ...(opts?.revokedKids ? { revokedKids: opts.revokedKids } : {}),
  } as Agent;
}

function addAgentToState(state: IdentityState, agent: Agent): IdentityState {
  const res = registerAgent(state, agent);
  if (res.ok) return res.state;
  const agents = new Map(state.agents);
  agents.set(agent.id, agent);
  return { ...state, agents };
}

function makeModelRecord(id: string, owner: string, tenantId = TENANT): Model {
  return {
    id,
    tenantId,
    name: `sha256:${sha256Hex(`model:${id}`)}`,
    description: `Model ${id}`,
    architecture: "transformer",
    createdAt: "2026-10-24T12:00:00Z",
    owner,
    currentVersion: null,
    status: "active",
  };
}

function makeVersionRecord(
  id: string,
  modelId: string,
  opts?: { tenantId?: string; repo?: string },
): ModelVersion {
  return {
    id,
    modelId,
    tenantId: opts?.tenantId ?? TENANT,
    versionNumber: 1,
    weightsHash: "a".repeat(64),
    configHash: "b".repeat(64),
    manifestHash: "c".repeat(64),
    datasetRefs: [],
    createdAt: "2026-10-24T12:00:00Z",
    status: "registered",
    ...(opts?.repo !== undefined ? { repo: opts.repo } : {}),
  };
}

interface StartedServer {
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
  readonly events: Array<Record<string, unknown>>;
}

async function startServer(
  identity: IdentityState,
  extra?: Record<string, unknown>,
): Promise<StartedServer> {
  const { events, store } = createFakeEventStore();
  const { server } = createCognateServer({
    state: {
      registry: createModelRegistry(),
      identity,
      prompts: createPromptStore(),
    },
    port: 0,
    host: "127.0.0.1",
    eventStore: store as ServerContext["eventStore"],
    tenantRoots: TEST_ONLY_TENANT_ROOTS,
    allowTestOnlyRoots: true,
    ...(extra ?? {}),
  } as ServerContext);

  return new Promise<StartedServer>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        events,
        close: () =>
          new Promise<void>((resClose) => {
            server.close(() => resClose());
          }),
      });
    });
  });
}

describe("PR (a) — Cognate signed requests, replay protection, actor binding, and escalation guards", () => {
  let srv: StartedServer | null = null;

  afterEach(async () => {
    if (srv) {
      await srv.close();
      srv = null;
    }
  });

  it("1. dn §2.4 test vectors (request signature) pass byte for byte and server rejects corrupted vector signature", async () => {
    const vectorSeedHex = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
    const expectedPubKeyB64Url = "ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ";
    const expectedKid = "65b60673d6ed884bf01c2c222d82ada0740f29ac3355d6a925c81f17f47a27b8";
    const rawBody = '{"from":"evaluated","reason":"all gates passed","to":"approved"}';
    const expectedBodySha256 = "1c4966617940c1a9df0331ea6f9b426b759b4f77c7564bba8f4062ff938d1900";
    const expectedCanonical = [
      "cognate-request-v1",
      "POST",
      "/registry/versions/ver-001",
      expectedBodySha256,
      "2026-10-24T18:00:00Z",
      "AAECAwQFBgcICQoLDA0ODw",
      "agent-deployer-1",
      expectedKid,
    ].join("\n");
    const expectedSignature =
      "GZ1r8yW9bil-8Ta5qjcAxkA0pNSsHezFdyDIxElvYl6yoC2YL6G0CxM-DGIvaQ8q8ujydw2gPBZvzKdMV_38DA";

    const kp = makeKeyPairFromSeedHex(vectorSeedHex);
    expect(kp.publicKey).toBe(expectedPubKeyB64Url);
    expect(kp.kid).toBe(expectedKid);
    expect(sha256Hex(Buffer.from(rawBody, "utf8"))).toBe(expectedBodySha256);

    const builtCanonical = buildCanonicalRequest({
      method: "POST",
      path: "/registry/versions/ver-001",
      bodyBytes: Buffer.from(rawBody, "utf8"),
      timestamp: "2026-10-24T18:00:00Z",
      nonce: "AAECAwQFBgcICQoLDA0ODw",
      agentId: "agent-deployer-1",
      kid: expectedKid,
    });
    expect(builtCanonical).toBe(expectedCanonical);
    expect(signCanonicalString(builtCanonical, vectorSeedHex)).toBe(expectedSignature);

    // Server must reject a request with a corrupted signature (401 auth.unauthenticated)
    let identity = createIdentityRegistry();
    identity = addAgentToState(identity, seedAgentRecord("agent-deployer-1", kp));
    srv = await startServer(identity);

    const badSig =
      "AZ1r8yW9bil-8Ta5qjcAxkA0pNSsHezFdyDIxElvYl6yoC2YL6G0CxM-DGIvaQ8q8ujydw2gPBZvzKdMV_38DA";
    const badReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-deployer-1",
      keyPair: kp,
      body: { model: makeModelRecord("m-vec", "agent-deployer-1") },
      headerOverrides: { "X-Signature": badSig },
    });
    const res = await fetch(`${srv.baseUrl}${badReq.path}`, badReq.init);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("auth.unauthenticated");
  });

  it("2. dj §3 forgery: a transition with a body actorId other than the signer gets 403 and nothing is appended", async () => {
    const submitterKey = makeDeterministicKeyPair("submitter");
    let identity = createIdentityRegistry();
    identity = addAgentToState(identity, seedAgentRecord("agent-submitter", submitterKey));
    srv = await startServer(identity);

    // Register model and version as agent-submitter
    const modelReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-submitter",
      keyPair: submitterKey,
      body: { model: makeModelRecord("model-1", "agent-submitter") },
    });
    expect((await fetch(`${srv.baseUrl}${modelReq.path}`, modelReq.init)).status).toBe(200);

    const verReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/versions/ver-1",
      agentId: "agent-submitter",
      keyPair: submitterKey,
      body: { version: makeVersionRecord("ver-1", "model-1") },
    });
    expect((await fetch(`${srv.baseUrl}${verReq.path}`, verReq.init)).status).toBe(200);

    const eventsBeforeTransition = srv.events.length;

    // Attempt dj §3 forgery: signed by agent-submitter, but body actorId claims "approver-alice"
    const forgedTransition = makeSignedRequestInit({
      method: "POST",
      path: "/registry/versions/ver-1",
      agentId: "agent-submitter",
      keyPair: submitterKey,
      body: {
        from: "registered",
        to: "evaluated",
        actorId: "approver-alice",
        reason: "forged actor id",
      },
    });
    const res = await fetch(`${srv.baseUrl}${forgedTransition.path}`, forgedTransition.init);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("auth.actor-mismatch");
    expect(srv.events.length).toBe(eventsBeforeTransition);
  });

  it("3. each signed field altered alone (method, path, body, timestamp, nonce, agent id, kid), replay, stale timestamp, unknown key, and revoked key gets byte-identical 401", async () => {
    const agent1Key = makeDeterministicKeyPair("agent-1");
    const agent2Key = makeDeterministicKeyPair("agent-2");
    const revokedKey = makeDeterministicKeyPair("agent-revoked");
    const rotatedOldKey = makeDeterministicKeyPair("agent-rotated-old");
    const rotatedNewKey = makeDeterministicKeyPair("agent-rotated-new");

    let identity = createIdentityRegistry();
    identity = addAgentToState(identity, seedAgentRecord("agent-1", agent1Key));
    identity = addAgentToState(identity, seedAgentRecord("agent-2", agent2Key));
    identity = addAgentToState(
      identity,
      seedAgentRecord("agent-revoked", revokedKey, { status: "revoked" }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("agent-rotated", rotatedNewKey, { revokedKids: [rotatedOldKey.kid] }),
    );

    srv = await startServer(identity);

    const validModelPayload = { model: makeModelRecord("model-auth", "agent-1") };

    // (a) Altered method: signed GET /registry/models, sent as POST /registry/models
    const methodTampered = makeSignedRequestInit({
      method: "GET",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: agent1Key,
    });
    const resMethod = await fetch(`${srv.baseUrl}/registry/models`, {
      method: "POST",
      headers: { ...methodTampered.init.headers, "Content-Type": "application/json" },
      body: jcsStringify({ model: makeModelRecord("model-auth-a", "agent-1") }),
    });

    // (b) Altered path: signed /registry/models, sent to /policy/evaluate
    const pathTampered = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: agent1Key,
      body: { model: makeModelRecord("model-auth-b", "agent-1") },
    });
    const resPath = await fetch(`${srv.baseUrl}/policy/evaluate`, pathTampered.init);

    // (c) Altered body: signed validModelPayload, sent modified JSON
    const bodyTampered = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: agent1Key,
      body: { model: makeModelRecord("model-auth-c", "agent-1") },
    });
    const resBody = await fetch(`${srv.baseUrl}/registry/models`, {
      ...bodyTampered.init,
      body: jcsStringify({ model: { ...makeModelRecord("model-auth-c", "agent-1"), description: "Tampered" } }),
    });

    // (d) Altered timestamp
    const otherTs = new Date(Date.now() - 5000).toISOString();
    const tsTampered = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: agent1Key,
      body: { model: makeModelRecord("model-auth-d", "agent-1") },
      headerOverrides: { "X-Timestamp": otherTs },
    });
    const resTimestamp = await fetch(`${srv.baseUrl}/registry/models`, tsTampered.init);

    // (e) Altered nonce
    const nonceTampered = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: agent1Key,
      body: { model: makeModelRecord("model-auth-e", "agent-1") },
      headerOverrides: { "X-Nonce": randomBytes(16).toString("base64url") },
    });
    const resNonce = await fetch(`${srv.baseUrl}/registry/models`, nonceTampered.init);

    // (f) Altered agent id
    const agentIdTampered = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: agent1Key,
      body: { model: makeModelRecord("model-auth-f", "agent-2") },
      headerOverrides: { "X-Agent-Id": "agent-2" },
    });
    const resAgentId = await fetch(`${srv.baseUrl}/registry/models`, agentIdTampered.init);

    // (g) Altered kid
    const kidTampered = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: agent1Key,
      body: { model: makeModelRecord("model-auth-g", "agent-1") },
      headerOverrides: { "X-Key-Id": agent2Key.kid },
    });
    const resKid = await fetch(`${srv.baseUrl}/registry/models`, kidTampered.init);

    // (h) Replay: first request succeeds (200), second identical request is rejected (401)
    const validReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: agent1Key,
      body: validModelPayload,
    });
    const firstRes = await fetch(`${srv.baseUrl}/registry/models`, validReq.init);
    expect(firstRes.status).toBe(200);
    const resReplay = await fetch(`${srv.baseUrl}/registry/models`, validReq.init);

    // (i) Stale timestamp (outside ±300 s)
    const staleTs = new Date(Date.now() - 360_000).toISOString();
    const staleReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: agent1Key,
      body: { model: makeModelRecord("model-stale", "agent-1") },
      timestamp: staleTs,
    });
    const resStale = await fetch(`${srv.baseUrl}/registry/models`, staleReq.init);

    // (j) Unknown key
    const unknownKey = makeDeterministicKeyPair("unknown-key");
    const unknownKeyReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: unknownKey,
      body: { model: makeModelRecord("model-unk", "agent-1") },
    });
    const resUnknownKey = await fetch(`${srv.baseUrl}/registry/models`, unknownKeyReq.init);

    // (k) Revoked / rotated-out key
    const revokedAgentReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-revoked",
      keyPair: revokedKey,
      body: { model: makeModelRecord("model-rev", "agent-revoked") },
    });
    const resRevokedAgent = await fetch(`${srv.baseUrl}/registry/models`, revokedAgentReq.init);

    const rotatedOutKeyReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-rotated",
      keyPair: rotatedOldKey,
      body: { model: makeModelRecord("model-rot", "agent-rotated") },
    });
    const resRotatedKey = await fetch(`${srv.baseUrl}/registry/models`, rotatedOutKeyReq.init);

    const all401Responses = [
      resMethod,
      resPath,
      resBody,
      resTimestamp,
      resNonce,
      resAgentId,
      resKid,
      resReplay,
      resStale,
      resUnknownKey,
      resRevokedAgent,
      resRotatedKey,
    ];

    const rawBodies: string[] = [];
    for (const r of all401Responses) {
      expect(r.status).toBe(401);
      rawBodies.push(await r.text());
    }

    const parsed = JSON.parse(rawBodies[0]!) as { code?: string };
    expect(parsed.code).toBe("auth.unauthenticated");
    for (const text of rawBodies) {
      expect(text).toBe(rawBodies[0]);
    }
  });

  it("4. a non-canonical body gets 400 auth.body-not-canonical", async () => {
    const agentKey = makeDeterministicKeyPair("agent-1");
    let identity = createIdentityRegistry();
    identity = addAgentToState(identity, seedAgentRecord("agent-1", agentKey));
    srv = await startServer(identity);

    // Non-JCS-canonical JSON (pretty-printed with whitespace and unsorted keys)
    const nonCanonicalRaw = JSON.stringify(
      { model: makeModelRecord("m-non-canon", "agent-1") },
      null,
      2,
    );

    const req = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "agent-1",
      keyPair: agentKey,
      rawBodyOverride: nonCanonicalRaw,
    });
    const res = await fetch(`${srv.baseUrl}${req.path}`, req.init);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("auth.body-not-canonical");
  });

  it("5a. root key bootstrap works for the first delegate only", async () => {
    const humanDelegateKey = makeDeterministicKeyPair("human-delegate");
    const secondBootKey = makeDeterministicKeyPair("second-boot");

    srv = await startServer(createIdentityRegistry());

    // First delegate agent bootstrapped by tenant root key succeeds (200)
    const bootReq1 = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents",
      agentId: ROOT_ACTOR_ID,
      keyPair: ROOT_KEY,
      body: {
        agent: seedAgentRecord("human-delegate-1", humanDelegateKey, {
          owner: ROOT_ACTOR_ID,
          principal: "human",
          capabilities: [
            {
              kind: "delegate",
              scope: "*",
              grantedBy: ROOT_ACTOR_ID,
              grantedAt: "2026-10-24T12:00:00Z",
              expiresAt: null,
            },
          ],
        }),
      },
    });
    const bootRes1 = await fetch(`${srv.baseUrl}${bootReq1.path}`, bootReq1.init);
    expect(bootRes1.status).toBe(201);

    // Second root bootstrap delegate in the same tenant is refused (403)
    const bootReq2 = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents",
      agentId: ROOT_ACTOR_ID,
      keyPair: ROOT_KEY,
      body: {
        agent: seedAgentRecord("human-delegate-2", secondBootKey, {
          owner: ROOT_ACTOR_ID,
          principal: "human",
          capabilities: [
            {
              kind: "delegate",
              scope: "*",
              grantedBy: ROOT_ACTOR_ID,
              grantedAt: "2026-10-24T12:00:00Z",
              expiresAt: null,
            },
          ],
        }),
      },
    });
    const bootRes2 = await fetch(`${srv.baseUrl}${bootReq2.path}`, bootReq2.init);
    expect(bootRes2.status).toBe(403);
  });

  it("5b. ruling 5 guard: grant approval requires delegate capability and refuses self-approval", async () => {
    const humanDelegateKey = makeDeterministicKeyPair("human-del-5b");
    const agentDelegateKey = makeDeterministicKeyPair("agent-del-5b");
    const plainAgentKey = makeDeterministicKeyPair("plain-5b");

    let identity = createIdentityRegistry();
    identity = addAgentToState(
      identity,
      seedAgentRecord("human-del-5b", humanDelegateKey, {
        principal: "human",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("agent-del-5b", agentDelegateKey, {
        principal: "agent",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: "human-del-5b",
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    identity = addAgentToState(identity, seedAgentRecord("plain-5b", plainAgentKey));
    srv = await startServer(identity);

    const grantReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants",
      agentId: "human-del-5b",
      keyPair: humanDelegateKey,
      body: {
        grant: {
          id: "grant-5b",
          agentId: "agent-del-5b",
          tenantId: TENANT,
          capability: {
            kind: "approve",
            scope: "*",
            grantedBy: "human-del-5b",
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
          requestedBy: "human-del-5b",
          approvedBy: null,
          status: "pending",
          requestedAt: "2026-10-24T12:00:00Z",
          approvedAt: null,
        } satisfies CapabilityGrant,
      },
    });
    expect((await fetch(`${srv.baseUrl}${grantReq.path}`, grantReq.init)).status).toBe(200);

    // Without delegate capability -> 403
    const noCapApproveReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants/grant-5b/approve",
      agentId: "plain-5b",
      keyPair: plainAgentKey,
      body: { approverId: "plain-5b", timestamp: "2026-10-24T12:05:00Z" },
    });
    expect((await fetch(`${srv.baseUrl}${noCapApproveReq.path}`, noCapApproveReq.init)).status).toBe(403);

    // Self-approval (even when holding delegate) -> 403
    const selfApproveReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants/grant-5b/approve",
      agentId: "agent-del-5b",
      keyPair: agentDelegateKey,
      body: { approverId: "agent-del-5b", timestamp: "2026-10-24T12:05:00Z" },
    });
    expect((await fetch(`${srv.baseUrl}${selfApproveReq.path}`, selfApproveReq.init)).status).toBe(403);
  });

  it("5c. ruling 5 guard: an agent principal cannot register a human principal", async () => {
    const agentDelegateKey = makeDeterministicKeyPair("agent-del-5c");
    const humanTargetKey = makeDeterministicKeyPair("human-target-5c");

    let identity = createIdentityRegistry();
    identity = addAgentToState(
      identity,
      seedAgentRecord("agent-del-5c", agentDelegateKey, {
        principal: "agent",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    srv = await startServer(identity);

    const agentRegHumanReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents",
      agentId: "agent-del-5c",
      keyPair: agentDelegateKey,
      body: {
        agent: seedAgentRecord("human-by-agent", humanTargetKey, {
          owner: "agent-del-5c",
          principal: "human",
        }),
      },
    });
    const res = await fetch(`${srv.baseUrl}${agentRegHumanReq.path}`, agentRegHumanReq.init);
    expect(res.status).toBe(403);
  });

  it("5d. ruling 5 guard: an agent principal cannot grant the delegate capability", async () => {
    const agentDelegateKey = makeDeterministicKeyPair("agent-del-5d");
    const plainAgentKey = makeDeterministicKeyPair("plain-5d");

    let identity = createIdentityRegistry();
    identity = addAgentToState(
      identity,
      seedAgentRecord("agent-del-5d", agentDelegateKey, {
        principal: "agent",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    identity = addAgentToState(identity, seedAgentRecord("plain-5d", plainAgentKey));
    srv = await startServer(identity);

    const agentGrantDelReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants",
      agentId: "agent-del-5d",
      keyPair: agentDelegateKey,
      body: {
        grant: {
          id: "grant-del-by-agent",
          agentId: "plain-5d",
          tenantId: TENANT,
          capability: {
            kind: "delegate",
            scope: "*",
            grantedBy: "agent-del-5d",
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
          requestedBy: "agent-del-5d",
          approvedBy: null,
          status: "pending",
          requestedAt: "2026-10-24T12:00:00Z",
          approvedAt: null,
        } satisfies CapabilityGrant,
      },
    });
    const res = await fetch(`${srv.baseUrl}${agentGrantDelReq.path}`, agentGrantDelReq.init);
    expect(res.status).toBe(403);
  });

  it("5e. ruling 5 guard: an owner cannot rotate a human principal's key, and rotated-out keys are refused", async () => {
    const ownerKey = makeDeterministicKeyPair("human-owner-5e");
    const humanTargetKey = makeDeterministicKeyPair("human-target-5e");
    const rotatedKey = makeDeterministicKeyPair("rotated-key-5e");

    let identity = createIdentityRegistry();
    identity = addAgentToState(
      identity,
      seedAgentRecord("human-owner-5e", ownerKey, {
        principal: "human",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("human-target-5e", humanTargetKey, {
        owner: "human-owner-5e",
        principal: "human",
      }),
    );
    srv = await startServer(identity);

    // Owner cannot rotate human-target-5e's key -> 403
    const ownerRotateHumanReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents/human-target-5e/key",
      agentId: "human-owner-5e",
      keyPair: ownerKey,
      body: { publicKey: rotatedKey.publicKey },
    });
    const ownerRotateHumanRes = await fetch(
      `${srv.baseUrl}${ownerRotateHumanReq.path}`,
      ownerRotateHumanReq.init,
    );
    expect(ownerRotateHumanRes.status).toBe(403);

    // Human target's own current key CAN rotate its key -> 200
    const selfRotateHumanReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents/human-target-5e/key",
      agentId: "human-target-5e",
      keyPair: humanTargetKey,
      body: { publicKey: rotatedKey.publicKey },
    });
    expect((await fetch(`${srv.baseUrl}${selfRotateHumanReq.path}`, selfRotateHumanReq.init)).status).toBe(200);

    // Old key is now rotated out -> 401
    const oldKeyReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "human-target-5e",
      keyPair: humanTargetKey,
      body: { model: makeModelRecord("m-old-key", "human-target-5e") },
    });
    expect((await fetch(`${srv.baseUrl}${oldKeyReq.path}`, oldKeyReq.init)).status).toBe(401);
  });

  it("6. log mode: startup is refused without a sunset or >14 days out; unsigned requests are refused after sunset; /identity/* stays signed in log mode", async () => {
    const agentKey = makeDeterministicKeyPair("agent-log");
    let identity = createIdentityRegistry();
    identity = addAgentToState(identity, seedAgentRecord("agent-log", agentKey));
    const { store } = createFakeEventStore();

    // (a) Startup refused without signedRequestsLogUntil
    expect(() =>
      createCognateServer({
        state: {
          registry: createModelRegistry(),
          identity,
          prompts: createPromptStore(),
        },
        port: 0,
        host: "127.0.0.1",
        eventStore: store as ServerContext["eventStore"],
        signedRequests: "log",
      } as ServerContext),
    ).toThrow();

    // (b) Startup refused when signedRequestsLogUntil > 14 days away
    const fifteenDaysOut = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    expect(() =>
      createCognateServer({
        state: {
          registry: createModelRegistry(),
          identity,
          prompts: createPromptStore(),
        },
        port: 0,
        host: "127.0.0.1",
        eventStore: store as ServerContext["eventStore"],
        signedRequests: "log",
        signedRequestsLogUntil: fifteenDaysOut,
      } as ServerContext),
    ).toThrow();

    // (c) Startup with a short sunset (150ms in future): /identity/* still requires signature immediately, and unsigned routes fail after sunset
    const shortSunset = new Date(Date.now() + 150).toISOString();
    srv = await startServer(identity, {
      signedRequests: "log",
      signedRequestsLogUntil: shortSunset,
    });

    // /identity/* refuses unsigned request even before sunset
    const unsignedIdentityRes = await fetch(`${srv.baseUrl}/identity/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Id": "agent-log",
        "X-Timestamp": new Date().toISOString(),
      },
      body: JSON.stringify({ agent: seedAgentRecord("unsigned-agent", makeDeterministicKeyPair("u")) }),
    });
    expect(unsignedIdentityRes.status).toBe(401);

    // Wait for sunset to expire
    await new Promise((resolve) => setTimeout(resolve, 220));

    const unsignedAfterSunsetRes = await fetch(`${srv.baseUrl}/registry/models`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Id": "agent-log",
        "X-Timestamp": new Date().toISOString(),
      },
      body: JSON.stringify({ model: makeModelRecord("m-after-sunset", "agent-log") }),
    });
    expect(unsignedAfterSunsetRes.status).toBe(401);
  });

  it("7. hashed-identifier checks refuse plaintext values while allowing the owner property key", async () => {
    const delegateKey = makeDeterministicKeyPair("del-hash");
    let identity = createIdentityRegistry();
    identity = addAgentToState(
      identity,
      seedAgentRecord("del-hash", delegateKey, {
        principal: "human",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    srv = await startServer(identity);

    // Valid Model with `owner` property key and non-account identifier value succeeds
    const validModelReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "del-hash",
      keyPair: delegateKey,
      body: { model: makeModelRecord("model-hash-ok", "del-hash") },
    });
    expect((await fetch(`${srv.baseUrl}${validModelReq.path}`, validModelReq.init)).status).toBe(200);

    // Plaintext version.repo ("acme/weights") is refused with 400 PLAINTEXT_ACCOUNT_IDENTIFIER
    const badRepoVerReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/versions/ver-bad-repo",
      agentId: "del-hash",
      keyPair: delegateKey,
      body: { version: makeVersionRecord("ver-bad-repo", "model-hash-ok", { repo: "acme/weights" }) },
    });
    const badRepoRes = await fetch(`${srv.baseUrl}${badRepoVerReq.path}`, badRepoVerReq.init);
    expect(badRepoRes.status).toBe(400);
    const badRepoBody = (await badRepoRes.json()) as { code?: string };
    expect(badRepoBody.code).toBe("PLAINTEXT_ACCOUNT_IDENTIFIER");

    // Plaintext agent.name ("acme/secret-agent") is refused with 400 PLAINTEXT_ACCOUNT_IDENTIFIER
    const badAgentNameReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents",
      agentId: "del-hash",
      keyPair: delegateKey,
      body: {
        agent: {
          ...seedAgentRecord("agent-bad-name", makeDeterministicKeyPair("bad-name"), {
            owner: "del-hash",
          }),
          name: "acme/secret-agent",
        },
      },
    });
    const badAgentRes = await fetch(`${srv.baseUrl}${badAgentNameReq.path}`, badAgentNameReq.init);
    expect(badAgentRes.status).toBe(400);
    const badAgentBody = (await badAgentRes.json()) as { code?: string };
    expect(badAgentBody.code).toBe("PLAINTEXT_ACCOUNT_IDENTIFIER");
  });

  it("8. GET /health returns serverTime and the client signing helper corrects clock offset and retries once on 401", async () => {
    const agentKey = makeDeterministicKeyPair("agent-health");
    let identity = createIdentityRegistry();
    identity = addAgentToState(identity, seedAgentRecord("agent-health", agentKey));
    srv = await startServer(identity);

    const healthRes = await fetch(`${srv.baseUrl}/health`);
    expect(healthRes.status).toBe(200);
    const healthBody = (await healthRes.json()) as { status: string; serverTime?: string };
    expect(typeof healthBody.serverTime).toBe("string");
    expect(Number.isNaN(Date.parse(healthBody.serverTime!))).toBe(false);

    // Client helper starts with a skewed local clock (-10 minutes, outside ±300 s window).
    // First attempt gets 401 auth.unauthenticated, helper reads /health serverTime, corrects offset, and retries once to succeed!
    const { createSignedClient } = await import("../src/client.js");
    const skewedClient = createSignedClient({
      baseUrl: srv.baseUrl,
      agentId: "agent-health",
      seedHex: agentKey.seedHex,
      nowFn: () => Date.now() - 600_000,
    });
    const res = await skewedClient.request("/registry/models", {
      method: "POST",
      body: { model: makeModelRecord("m-clock-skew", "agent-health") },
    });
    expect(res.status).toBe(200);
    expect(Math.abs(skewedClient.getClockOffsetMs() - 600_000)).toBeLessThan(5_000);
  });

  it("9. actor binding across evaluations, grants, agents, prompts, outputs, models, and policy/evaluate", async () => {
    const signerKey = makeDeterministicKeyPair("signer-9");
    const targetKey = makeDeterministicKeyPair("target-9");
    let identity = createIdentityRegistry();
    identity = addAgentToState(
      identity,
      seedAgentRecord("signer-9", signerKey, {
        principal: "human",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    identity = addAgentToState(identity, seedAgentRecord("target-9", targetKey, { owner: "signer-9" }));
    srv = await startServer(identity);

    // Model owner mismatch -> 403
    const badModelOwner = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { model: makeModelRecord("m-9", "forged-owner") },
    });
    expect((await fetch(`${srv.baseUrl}${badModelOwner.path}`, badModelOwner.init)).status).toBe(403);

    // Seed model and version
    const okModel = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { model: makeModelRecord("m-9", "signer-9") },
    });
    expect((await fetch(`${srv.baseUrl}${okModel.path}`, okModel.init)).status).toBe(200);
    const okVer = makeSignedRequestInit({
      method: "POST",
      path: "/registry/versions/v-9",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { version: makeVersionRecord("v-9", "m-9") },
    });
    expect((await fetch(`${srv.baseUrl}${okVer.path}`, okVer.init)).status).toBe(200);

    // Evaluation evaluator mismatch -> 403
    const badEval = makeSignedRequestInit({
      method: "POST",
      path: "/registry/versions/v-9/evaluations",
      agentId: "signer-9",
      keyPair: signerKey,
      body: {
        evaluation: {
          id: "eval-9",
          tenantId: TENANT,
          modelVersionId: "v-9",
          evaluator: "forged-evaluator",
          evaluatedAt: "2026-10-24T12:00:00Z",
          metrics: [{ name: "acc", value: 1, threshold: 0.9, operator: "gte", passed: true }],
          overall: "pass",
          notes: "ok",
        },
      },
    });
    expect((await fetch(`${srv.baseUrl}${badEval.path}`, badEval.init)).status).toBe(403);

    // Agent owner mismatch -> 403, invalid publicKey -> 400
    const badAgentOwner = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { agent: seedAgentRecord("ag-bad-owner", makeDeterministicKeyPair("ag-bo"), { owner: "forged" }) },
    });
    expect((await fetch(`${srv.baseUrl}${badAgentOwner.path}`, badAgentOwner.init)).status).toBe(403);

    const badAgentPub = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { agent: { ...seedAgentRecord("ag-bad-pub", makeDeterministicKeyPair("ag-bp"), { owner: "signer-9" }), publicKey: null } },
    });
    expect((await fetch(`${srv.baseUrl}${badAgentPub.path}`, badAgentPub.init)).status).toBe(400);

    // Grant requestedBy mismatch -> 403, capability.grantedBy mismatch -> 403, pre-approved status -> 400
    const baseGrant = {
      id: "g-9",
      agentId: "target-9",
      tenantId: TENANT,
      capability: {
        kind: "inference",
        scope: { kind: "unlimited" },
        constraints: [],
        grantedBy: "signer-9",
        grantedAt: "2026-10-24T12:00:00Z",
        expiresAt: null,
      },
      requestedBy: "signer-9",
      approvedBy: null,
      status: "pending",
      requestedAt: "2026-10-24T12:00:00Z",
      approvedAt: null,
    };
    const badGrantReqBy = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { grant: { ...baseGrant, requestedBy: "forged" } },
    });
    expect((await fetch(`${srv.baseUrl}${badGrantReqBy.path}`, badGrantReqBy.init)).status).toBe(403);

    const badGrantGrantedBy = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { grant: { ...baseGrant, capability: { ...baseGrant.capability, grantedBy: "forged" } } },
    });
    expect((await fetch(`${srv.baseUrl}${badGrantGrantedBy.path}`, badGrantGrantedBy.init)).status).toBe(403);

    const badGrantStatus = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { grant: { ...baseGrant, status: "approved", approvedBy: "signer-9" } },
    });
    expect((await fetch(`${srv.baseUrl}${badGrantStatus.path}`, badGrantStatus.init)).status).toBe(400);

    // Valid grant + approverId mismatch on approve -> 403
    const okGrant = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { grant: baseGrant },
    });
    expect((await fetch(`${srv.baseUrl}${okGrant.path}`, okGrant.init)).status).toBe(200);

    const badApproveActor = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants/g-9/approve",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { approverId: "forged", timestamp: "2026-10-24T12:05:00Z" },
    });
    expect((await fetch(`${srv.baseUrl}${badApproveActor.path}`, badApproveActor.init)).status).toBe(403);

    // Prompt agentId mismatch -> 403; valid prompt & output record actorId in event metadata
    const basePrompt = {
      id: "p-9",
      tenantId: TENANT,
      sessionId: "s-9",
      modelVersionId: "v-9",
      policyVersion: 1,
      agentId: null,
      plaintextHash: "h1",
      ciphertext: "c1",
      metadata: { tokensIn: 5, systemPromptHash: null, temperature: 0, topP: null, tags: [] },
      submittedAt: "2026-10-24T12:00:00Z",
    };
    const badPromptActor = makeSignedRequestInit({
      method: "POST",
      path: "/prompts",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { prompt: { ...basePrompt, agentId: "forged-agent" } },
    });
    expect((await fetch(`${srv.baseUrl}${badPromptActor.path}`, badPromptActor.init)).status).toBe(403);

    const okPrompt = makeSignedRequestInit({
      method: "POST",
      path: "/prompts",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { prompt: basePrompt },
    });
    expect((await fetch(`${srv.baseUrl}${okPrompt.path}`, okPrompt.init)).status).toBe(201);

    const okOutput = makeSignedRequestInit({
      method: "POST",
      path: "/prompts/p-9/outputs",
      agentId: "signer-9",
      keyPair: signerKey,
      body: {
        output: {
          id: "o-9",
          tenantId: TENANT,
          promptId: "p-9",
          modelVersionId: "v-9",
          plaintextHash: "h2",
          ciphertext: "c2",
          metadata: { tokensOut: 10, latencyMs: 50, finishReason: "stop", confidence: null },
          generatedAt: "2026-10-24T12:01:00Z",
        },
      },
    });
    expect((await fetch(`${srv.baseUrl}${okOutput.path}`, okOutput.init)).status).toBe(201);

    // Policy evaluate: actorId mismatch -> 403, agentId mismatch -> 403, forged capabilities -> 403, valid agentId -> 200
    const basePolicy = {
      id: "pol-9",
      tenantId: TENANT,
      name: "Policy 9",
      version: 1,
      rules: [],
      createdAt: "2026-10-24T12:00:00Z",
      approvedBy: "signer-9",
      status: "active",
    };
    const baseCtx = {
      tenantId: TENANT,
      actorId: "signer-9",
      modelVersionId: "v-9",
      agentId: null,
      timestamp: "2026-10-24T12:00:00Z",
      promptText: "hello",
      outputText: null,
      metadata: { tokensIn: 1, tokensOut: null, latencyMs: null, confidence: null, finishReason: null, tags: [] },
      agentCapabilities: [],
      counters: { callsInWindow: 1, windowSeconds: 60, spendInWindow: 0, spendCurrency: "USD" },
    };

    const badPolActor = makeSignedRequestInit({
      method: "POST",
      path: "/policy/evaluate",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { policy: basePolicy, context: { ...baseCtx, actorId: "forged" } },
    });
    expect((await fetch(`${srv.baseUrl}${badPolActor.path}`, badPolActor.init)).status).toBe(403);

    const badPolAgent = makeSignedRequestInit({
      method: "POST",
      path: "/policy/evaluate",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { policy: basePolicy, context: { ...baseCtx, agentId: "target-9" } },
    });
    expect((await fetch(`${srv.baseUrl}${badPolAgent.path}`, badPolAgent.init)).status).toBe(403);

    const badPolCapsWhenNullAgent = makeSignedRequestInit({
      method: "POST",
      path: "/policy/evaluate",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { policy: basePolicy, context: { ...baseCtx, agentCapabilities: [{ kind: "spend" }] } },
    });
    expect((await fetch(`${srv.baseUrl}${badPolCapsWhenNullAgent.path}`, badPolCapsWhenNullAgent.init)).status).toBe(403);

    const badPolCapsWhenMatchedAgent = makeSignedRequestInit({
      method: "POST",
      path: "/policy/evaluate",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { policy: basePolicy, context: { ...baseCtx, agentId: "signer-9", agentCapabilities: [{ kind: "spend" }] } },
    });
    expect((await fetch(`${srv.baseUrl}${badPolCapsWhenMatchedAgent.path}`, badPolCapsWhenMatchedAgent.init)).status).toBe(403);

    const okPolWithAgent = makeSignedRequestInit({
      method: "POST",
      path: "/policy/evaluate",
      agentId: "signer-9",
      keyPair: signerKey,
      body: { policy: basePolicy, context: { ...baseCtx, agentId: "signer-9" } },
    });
    expect((await fetch(`${srv.baseUrl}${okPolWithAgent.path}`, okPolWithAgent.init)).status).toBe(200);
  });

  it("10. key rotation, revocation, log-mode unsigned event marking, and config helpers", async () => {
    const ownerKey = makeDeterministicKeyPair("owner-10");
    const agentKey = makeDeterministicKeyPair("agent-10");
    const newAgentKey = makeDeterministicKeyPair("agent-10-new");
    const bystanderKey = makeDeterministicKeyPair("bystander-10");

    let identity = createIdentityRegistry();
    identity = addAgentToState(
      identity,
      seedAgentRecord("owner-10", ownerKey, {
        principal: "human",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("agent-10", agentKey, { owner: "owner-10", principal: "agent" }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("bystander-10", bystanderKey, { owner: "bystander-10", principal: "agent" }),
    );

    const authLogs: unknown[] = [];
    const sunset = new Date(Date.now() + 3600_000).toISOString();
    srv = await startServer(identity, {
      signedRequests: "log",
      signedRequestsLogUntil: sunset,
      onAuthLog: (entry: unknown) => authLogs.push(entry),
    } as Partial<ServerContext>);

    // Unsigned request in log mode succeeds on non-identity route, logs sanitized warning, and marks event unsigned: true
    const unsignedModelRes = await fetch(`${srv.baseUrl}/registry/models`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Id": "owner-10",
        "X-Timestamp": new Date().toISOString(),
      },
      body: JSON.stringify({ model: makeModelRecord("m-log-10", "owner-10") }),
    });
    expect(unsignedModelRes.status).toBe(200);
    expect(authLogs.at(-1)).toEqual({
      level: "warn",
      method: "POST",
      pathname: "/registry/models",
      agentId: "owner-10",
      code: "auth.unsigned-request-logged",
    });

    const unsignedVerRes = await fetch(`${srv.baseUrl}/registry/versions/v-log-10`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Id": "owner-10",
        "X-Timestamp": new Date().toISOString(),
      },
      body: JSON.stringify({ version: makeVersionRecord("v-log-10", "m-log-10") }),
    });
    expect(unsignedVerRes.status).toBe(200);

    const unsignedTransRes = await fetch(`${srv.baseUrl}/registry/versions/v-log-10`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Id": "owner-10",
        "X-Timestamp": new Date().toISOString(),
      },
      body: JSON.stringify({
        from: "registered",
        to: "evaluated",
        actorId: "owner-10",
        reason: "unsigned log mode test",
      }),
    });
    expect(unsignedTransRes.status).toBe(200);
    expect((srv.events.at(-1)?.payload as Record<string, unknown>)?.unsigned).toBe(true);

    // Bystander cannot rotate or revoke agent-10 or owner-10 -> 403
    const bystanderRot = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents/agent-10/key",
      agentId: "bystander-10",
      keyPair: bystanderKey,
      body: { publicKey: newAgentKey.publicKey },
    });
    expect((await fetch(`${srv.baseUrl}${bystanderRot.path}`, bystanderRot.init)).status).toBe(403);

    const bystanderRevAgent = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents/agent-10/revoke",
      agentId: "bystander-10",
      keyPair: bystanderKey,
      body: {},
    });
    expect((await fetch(`${srv.baseUrl}${bystanderRevAgent.path}`, bystanderRevAgent.init)).status).toBe(403);

    const bystanderRevHuman = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents/owner-10/revoke",
      agentId: "bystander-10",
      keyPair: bystanderKey,
      body: {},
    });
    expect((await fetch(`${srv.baseUrl}${bystanderRevHuman.path}`, bystanderRevHuman.init)).status).toBe(403);

    // Owner rotates agent-10's key (missing publicKey -> 400, valid -> 200)
    const missingKeyRot = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents/agent-10/key",
      agentId: "owner-10",
      keyPair: ownerKey,
      body: {},
    });
    expect((await fetch(`${srv.baseUrl}${missingKeyRot.path}`, missingKeyRot.init)).status).toBe(400);

    const ownerRot = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents/agent-10/key",
      agentId: "owner-10",
      keyPair: ownerKey,
      body: { publicKey: newAgentKey.publicKey },
    });
    expect((await fetch(`${srv.baseUrl}${ownerRot.path}`, ownerRot.init)).status).toBe(200);

    // Owner revokes agent-10 -> 200
    const ownerRev = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents/agent-10/revoke",
      agentId: "owner-10",
      keyPair: ownerKey,
      body: {},
    });
    expect((await fetch(`${srv.baseUrl}${ownerRev.path}`, ownerRev.init)).status).toBe(200);

    // Config helpers unit checks
    const sigMod = await import("../src/middleware/signature.js");
    expect(sigMod.deriveKid(ownerKey.publicKey)).toBe(ownerKey.kid);
    expect(() => sigMod.deriveKid("invalid")).toThrow();
    expect(sigMod.signedRequestsConfigFromEnv({})).toEqual({ signedRequests: "enforce" });
    expect(
      sigMod.signedRequestsConfigFromEnv({
        COGNATE_SIGNED_REQUESTS: "log",
        COGNATE_SIGNED_REQUESTS_LOG_UNTIL: sunset,
      }),
    ).toEqual({ signedRequests: "log", signedRequestsLogUntil: sunset });
    expect(
      sigMod.loadTenantRootsConfig(TEST_ONLY_TENANT_ROOTS_PATH, { allowTestOnlyRoots: true }).length,
    ).toBeGreaterThanOrEqual(7);
  });

  it("11. additional branch coverage: approval-required constraint, root bootstrap cap limit, delegate revoke, and validation helpers", async () => {
    const humanDelKey = makeDeterministicKeyPair("hdel-11");
    const agentDelKey = makeDeterministicKeyPair("adel-11");
    const constrainedKey = makeDeterministicKeyPair("constrained-11");
    const targetHumanKey = makeDeterministicKeyPair("thuman-11");
    const targetAgentKey = makeDeterministicKeyPair("tagent-11");

    let identity = createIdentityRegistry();
    identity = addAgentToState(
      identity,
      seedAgentRecord("hdel-11", humanDelKey, {
        principal: "human",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("adel-11", agentDelKey, {
        principal: "agent",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: "hdel-11",
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("constrained-11", constrainedKey, {
        principal: "agent",
        capabilities: [
          {
            kind: "inference",
            scope: "*",
            constraints: [{ kind: "approval-required", approvers: ["hdel-11"] }],
            grantedBy: "hdel-11",
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("thuman-11", targetHumanKey, { owner: "hdel-11", principal: "human" }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("tagent-11", targetAgentKey, { owner: "hdel-11", principal: "agent" }),
    );
    srv = await startServer(identity);

    // Seed model + version
    const mReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/models",
      agentId: "hdel-11",
      keyPair: humanDelKey,
      body: { model: makeModelRecord("m-11", "hdel-11") },
    });
    expect((await fetch(`${srv.baseUrl}${mReq.path}`, mReq.init)).status).toBe(200);
    const vReq = makeSignedRequestInit({
      method: "POST",
      path: "/registry/versions/v-11",
      agentId: "hdel-11",
      keyPair: humanDelKey,
      body: { version: makeVersionRecord("v-11", "m-11") },
    });
    expect((await fetch(`${srv.baseUrl}${vReq.path}`, vReq.init)).status).toBe(200);

    // Constrained agent whose actorId is not in approval-required approvers -> 403 on transition
    const constrainedTrans = makeSignedRequestInit({
      method: "POST",
      path: "/registry/versions/v-11",
      agentId: "constrained-11",
      keyPair: constrainedKey,
      body: {
        from: "registered",
        to: "evaluated",
        actorId: "constrained-11",
        reason: "needs sign-off",
      },
    });
    expect((await fetch(`${srv.baseUrl}${constrainedTrans.path}`, constrainedTrans.init)).status).toBe(403);

    // Human delegate revokes another human principal -> 200; agent delegate revokes an agent principal -> 200
    const hRevokeHuman = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents/thuman-11/revoke",
      agentId: "hdel-11",
      keyPair: humanDelKey,
      body: {},
    });
    expect((await fetch(`${srv.baseUrl}${hRevokeHuman.path}`, hRevokeHuman.init)).status).toBe(200);

    const aRevokeAgent = makeSignedRequestInit({
      method: "POST",
      path: "/identity/agents/tagent-11/revoke",
      agentId: "adel-11",
      keyPair: agentDelKey,
      body: {},
    });
    expect((await fetch(`${srv.baseUrl}${aRevokeAgent.path}`, aRevokeAgent.init)).status).toBe(200);

    // Human delegate requests a delegate grant, and agent delegate attempts to approve it -> 403
    const delGrantReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants",
      agentId: "hdel-11",
      keyPair: humanDelKey,
      body: {
        grant: {
          id: "g-del-11",
          agentId: "constrained-11",
          tenantId: TENANT,
          capability: {
            kind: "delegate",
            scope: "*",
            grantedBy: "hdel-11",
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
          requestedBy: "hdel-11",
          approvedBy: null,
          status: "pending",
          requestedAt: "2026-10-24T12:00:00Z",
          approvedAt: null,
        },
      },
    });
    expect((await fetch(`${srv.baseUrl}${delGrantReq.path}`, delGrantReq.init)).status).toBe(200);

    const agentApproveDel = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants/g-del-11/approve",
      agentId: "adel-11",
      keyPair: agentDelKey,
      body: { approverId: "adel-11", timestamp: "2026-10-24T12:05:00Z" },
    });
    expect((await fetch(`${srv.baseUrl}${agentApproveDel.path}`, agentApproveDel.init)).status).toBe(403);

    // Validation helper branches in signature.ts and handleIdentity
    const sigMod = await import("../src/middleware/signature.js");
    const { handleIdentity } = await import("../src/routes/identity.js");
    expect(() => sigMod.validateSignedRequestsConfig("invalid" as "enforce")).toThrow();
    expect(() =>
      sigMod.validateTenantRootsList([{ tenantId: "" as never, kid: humanDelKey.kid, publicKey: humanDelKey.publicKey, actorId: "a" as never }]),
    ).toThrow();
    expect(() =>
      sigMod.validateTenantRootsList([
        { tenantId: "t1" as never, kid: humanDelKey.kid, publicKey: humanDelKey.publicKey, actorId: "a" as never },
        { tenantId: "t1" as never, kid: humanDelKey.kid, publicKey: humanDelKey.publicKey, actorId: "b" as never },
      ]),
    ).toThrow();
    expect(() =>
      sigMod.validateTenantRootsList([{ tenantId: "t1" as never, kid: humanDelKey.kid, publicKey: "bad", actorId: "a" as never }]),
    ).toThrow();
    expect(() =>
      sigMod.validateTenantRootsList([{ tenantId: "t1" as never, kid: "0".repeat(64), publicKey: humanDelKey.publicKey, actorId: "a" as never }]),
    ).toThrow();
    expect(() =>
      sigMod.validateTenantRootsList([{ tenantId: "t1" as never, kid: humanDelKey.kid, publicKey: humanDelKey.publicKey, actorId: "bad actor!" as never }]),
    ).toThrow();

    const dummyState = {
      registry: createModelRegistry(),
      identity,
      prompts: createPromptStore(),
    };
    expect(handleIdentity(dummyState, "/identity/grants", "POST", {}).ok).toBe(false);
    expect(handleIdentity(dummyState, "/identity/agents//revoke", "POST", {}).ok).toBe(false);
    expect(handleIdentity(dummyState, "/identity/grants//vc", "POST", {}).ok).toBe(false);
  });

  it("12. F1: tenant root keys require operator config in enforce mode, test-only fixtures require allowTestOnlyRoots, and no committed root uses test seeds", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const { TEST_ONLY_TENANT_ROOTS, TEST_ONLY_TENANT_ROOTS_PATH } = await import(
      "./fixtures/test-only-tenant-roots.js"
    );

    const testDir = fileURLToPath(new URL(".", import.meta.url));
    const committedConfigPath = resolve(testDir, "../config/tenant-roots.json");
    const dockerfilePath = resolve(testDir, "../../../Dockerfile");

    // (a) No committed root in packages/node/config/tenant-roots.json equals sha256("cognate-test-root-seed:" + tenantId)
    if (existsSync(committedConfigPath)) {
      const committed = JSON.parse(readFileSync(committedConfigPath, "utf8")) as {
        roots?: Array<{ tenantId: string; publicKey: string }>;
      };
      const roots = committed.roots ?? [];
      for (const entry of roots) {
        const derivedTestPub = makeKeyPairFromSeedHex(
          sha256Hex(`cognate-test-root-seed:${entry.tenantId}`),
        ).publicKey;
        expect(entry.publicKey).not.toBe(derivedTestPub);
      }
      expect(roots).toEqual([]);
    }

    // (b) Dockerfile copies no tenant-roots config into the production image
    const dockerfileText = readFileSync(dockerfilePath, "utf8");
    expect(dockerfileText).not.toContain("packages/node/config");

    // (c) In enforce mode, server refuses to start without operator-supplied roots, with structured error (code, message, hint)
    const { store } = createFakeEventStore();
    let missingErr: unknown = null;
    try {
      createCognateServer({
        state: {
          registry: createModelRegistry(),
          identity: createIdentityRegistry(),
          prompts: createPromptStore(),
        },
        port: 0,
        host: "127.0.0.1",
        eventStore: store as ServerContext["eventStore"],
        signedRequests: "enforce",
      });
    } catch (err) {
      missingErr = err;
    }
    expect(missingErr).toMatchObject({
      code: "auth.missing-tenant-roots",
      message: expect.any(String),
      hint: expect.any(String),
    });

    // (d) Test-only root keys are rejected at startup unless allowTestOnlyRoots is explicitly set
    let testKeyErr: unknown = null;
    try {
      createCognateServer({
        state: {
          registry: createModelRegistry(),
          identity: createIdentityRegistry(),
          prompts: createPromptStore(),
        },
        port: 0,
        host: "127.0.0.1",
        eventStore: store as ServerContext["eventStore"],
        signedRequests: "enforce",
        tenantRoots: TEST_ONLY_TENANT_ROOTS,
      });
    } catch (err) {
      testKeyErr = err;
    }
    expect(testKeyErr).toMatchObject({
      code: "auth.test-only-root-key-forbidden",
      message: expect.any(String),
      hint: expect.any(String),
    });

    let testPathErr: unknown = null;
    try {
      createCognateServer({
        state: {
          registry: createModelRegistry(),
          identity: createIdentityRegistry(),
          prompts: createPromptStore(),
        },
        port: 0,
        host: "127.0.0.1",
        eventStore: store as ServerContext["eventStore"],
        signedRequests: "enforce",
        tenantRootsPath: TEST_ONLY_TENANT_ROOTS_PATH,
      });
    } catch (err) {
      testPathErr = err;
    }
    expect(testPathErr).toMatchObject({
      code: "auth.test-only-root-key-forbidden",
      message: expect.any(String),
      hint: expect.any(String),
    });

    // Explicit test flag allows the test-only fixture roots
    expect(() =>
      createCognateServer({
        state: {
          registry: createModelRegistry(),
          identity: createIdentityRegistry(),
          prompts: createPromptStore(),
        },
        port: 0,
        host: "127.0.0.1",
        eventStore: store as ServerContext["eventStore"],
        signedRequests: "enforce",
        tenantRootsPath: TEST_ONLY_TENANT_ROOTS_PATH,
        allowTestOnlyRoots: true,
      } as ServerContext),
    ).not.toThrow();
  });

  it("13. F2: path normalisation refuses percent-encoded dot/slash/backslash, double encoding, and dot segments with 400 in both log and enforce mode", async () => {
    const { request: httpRequest } = await import("node:http");

    function sendRawPath(
      baseUrl: string,
      method: "GET" | "POST",
      rawPath: string,
      headers: Record<string, string>,
      rawBody: string,
    ): Promise<{ status: number; text: string }> {
      const parsedUrl = new URL(baseUrl);
      return new Promise((resolve, reject) => {
        const req = httpRequest(
          {
            hostname: parsedUrl.hostname,
            port: Number(parsedUrl.port),
            method,
            path: rawPath,
            headers: {
              ...headers,
              ...(method === "POST"
                ? {
                    "Content-Type": "application/json",
                    "Content-Length": String(Buffer.byteLength(rawBody, "utf8")),
                  }
                : {}),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () =>
              resolve({
                status: res.statusCode ?? 0,
                text: Buffer.concat(chunks).toString("utf8"),
              }),
            );
          },
        );
        req.on("error", reject);
        if (method === "POST" && rawBody.length > 0) {
          req.write(rawBody);
        }
        req.end();
      });
    }

    const delKey = makeDeterministicKeyPair("f2-del");
    const newAgentKey = makeDeterministicKeyPair("f2-new");
    let identity = createIdentityRegistry();
    identity = addAgentToState(
      identity,
      seedAgentRecord("f2-del", delKey, {
        principal: "human",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );

    const forbiddenPaths = [
      "/registry/%2e%2e/identity/agents",
      "/registry/%2E%2e/identity/agents",
      "/identity%2fagents",
      "/identity%5cagents",
      "/registry/%252e%252e/identity/agents",
      "/registry/../identity/agents",
    ];

    const payload = {
      agent: seedAgentRecord("f2-created", newAgentKey, {
        owner: "f2-del",
        principal: "human",
      }),
    };

    // (a) In log mode
    const sunset = new Date(Date.now() + 3600_000).toISOString();
    srv = await startServer(identity, {
      signedRequests: "log",
      signedRequestsLogUntil: sunset,
    });
    for (const rawPath of forbiddenPaths) {
      const res = await sendRawPath(
        srv.baseUrl,
        "POST",
        rawPath,
        {
          "X-Agent-Id": "f2-del",
          "X-Timestamp": new Date().toISOString(),
        },
        jcsStringify(payload),
      );
      expect(res.status, `log mode path ${rawPath}`).toBe(400);
    }
    await srv.close();
    srv = null;

    // (b) In enforce mode
    srv = await startServer(identity, {
      signedRequests: "enforce",
    });
    for (const rawPath of forbiddenPaths) {
      const signed = makeSignedRequestInit({
        method: "POST",
        path: rawPath,
        agentId: "f2-del",
        keyPair: delKey,
        body: payload,
      });
      const res = await sendRawPath(
        srv.baseUrl,
        "POST",
        rawPath,
        signed.init.headers as Record<string, string>,
        signed.rawBody,
      );
      expect(res.status, `enforce mode path ${rawPath}`).toBe(400);
    }
  });

  it("14. F3: capability expiry, approvedAt, and evaluatedAt use server time rather than request body timestamps", async () => {
    const expiredDelKey = makeDeterministicKeyPair("f3-expired-del");
    const activeDelKey = makeDeterministicKeyPair("f3-active-del");
    const targetKey = makeDeterministicKeyPair("f3-target");

    let identity = createIdentityRegistry();
    identity = addAgentToState(
      identity,
      seedAgentRecord("f3-expired-del", expiredDelKey, {
        principal: "human",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2025-01-01T00:00:00Z",
            expiresAt: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("f3-active-del", activeDelKey, {
        principal: "human",
        capabilities: [
          {
            kind: "delegate",
            scope: "*",
            grantedBy: ROOT_ACTOR_ID,
            grantedAt: "2025-01-01T00:00:00Z",
            expiresAt: null,
          },
        ],
      }),
    );
    identity = addAgentToState(
      identity,
      seedAgentRecord("f3-target", targetKey, {
        owner: "f3-active-del",
        principal: "agent",
      }),
    );

    srv = await startServer(identity);

    // Submit a pending grant for f3-target
    const grantReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants",
      agentId: "f3-active-del",
      keyPair: activeDelKey,
      body: {
        grant: {
          id: "g-f3",
          agentId: "f3-target",
          tenantId: TENANT,
          capability: {
            kind: "inference",
            scope: "*",
            grantedBy: "f3-active-del",
            grantedAt: "2026-10-24T12:00:00Z",
            expiresAt: null,
          },
          requestedBy: "f3-active-del",
          approvedBy: null,
          status: "pending",
          requestedAt: "2026-10-24T12:00:00Z",
          approvedAt: null,
        } satisfies CapabilityGrant,
      },
    });
    expect((await fetch(`${srv.baseUrl}${grantReq.path}`, grantReq.init)).status).toBe(200);

    // (a) Expired delegate with a backdated body timestamp (2025-06-01) is refused (403 auth.missing-capability)
    const backdatedApproveReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants/g-f3/approve",
      agentId: "f3-expired-del",
      keyPair: expiredDelKey,
      body: {
        approverId: "f3-expired-del",
        timestamp: "2025-06-01T00:00:00Z",
      },
    });
    const backdatedApproveRes = await fetch(
      `${srv.baseUrl}${backdatedApproveReq.path}`,
      backdatedApproveReq.init,
    );
    expect(backdatedApproveRes.status).toBe(403);
    expect(((await backdatedApproveRes.json()) as { code?: string }).code).toBe(
      "auth.missing-capability",
    );

    // (b) Active delegate approving with a backdated body timestamp records server time in approvedAt
    const beforeApproveMs = Date.now();
    const activeApproveReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants/g-f3/approve",
      agentId: "f3-active-del",
      keyPair: activeDelKey,
      body: {
        approverId: "f3-active-del",
        timestamp: "2020-01-01T00:00:00Z",
      },
    });
    expect((await fetch(`${srv.baseUrl}${activeApproveReq.path}`, activeApproveReq.init)).status).toBe(200);

    const vcReq = makeSignedRequestInit({
      method: "POST",
      path: "/identity/grants/g-f3/vc",
      agentId: "f3-active-del",
      keyPair: activeDelKey,
      body: { issuerId: "urn:cognate:test" },
    });
    const vcRes = await fetch(`${srv.baseUrl}${vcReq.path}`, vcReq.init);
    expect(vcRes.status).toBe(200);
    const vcBody = (await vcRes.json()) as {
      credential?: {
        credentialSubject?: { cognateCapabilityGrant?: { approvedAt?: string } };
      };
    };
    const recordedApprovedAt =
      vcBody.credential?.credentialSubject?.cognateCapabilityGrant?.approvedAt ?? "";
    expect(recordedApprovedAt).not.toBe("2020-01-01T00:00:00Z");
    expect(Date.parse(recordedApprovedAt)).toBeGreaterThanOrEqual(beforeApproveMs - 1000);

    // (c) Policy evaluate checks capabilities at server time and records server time for evaluatedAt
    const polBody = {
      policy: {
        id: "pol-f3",
        tenantId: TENANT,
        name: "Policy F3",
        version: 1,
        rules: [],
        createdAt: "2026-10-24T12:00:00Z",
        approvedBy: "f3-active-del",
        status: "active",
      },
      context: {
        tenantId: TENANT,
        actorId: "f3-expired-del",
        modelVersionId: "v-1",
        agentId: "f3-expired-del",
        timestamp: "2025-01-01T00:00:00Z",
        promptText: "test",
        outputText: null,
        metadata: {
          tokensIn: 1,
          tokensOut: null,
          latencyMs: null,
          confidence: null,
          finishReason: null,
          tags: [],
        },
        agentCapabilities: [{ kind: "delegate" }],
        counters: { callsInWindow: 1, windowSeconds: 60, spendInWindow: 0, spendCurrency: "USD" },
      },
    };
    const polClaimedExpiredCap = makeSignedRequestInit({
      method: "POST",
      path: "/policy/evaluate",
      agentId: "f3-expired-del",
      keyPair: expiredDelKey,
      body: polBody,
    });
    const polClaimedRes = await fetch(
      `${srv.baseUrl}${polClaimedExpiredCap.path}`,
      polClaimedExpiredCap.init,
    );
    expect(polClaimedRes.status).toBe(403);

    const beforePolMs = Date.now();
    const polValidReq = makeSignedRequestInit({
      method: "POST",
      path: "/policy/evaluate",
      agentId: "f3-expired-del",
      keyPair: expiredDelKey,
      body: {
        ...polBody,
        context: {
          ...polBody.context,
          timestamp: "2025-01-01T00:00:00Z",
          agentCapabilities: [],
        },
      },
    });
    const polValidRes = await fetch(`${srv.baseUrl}${polValidReq.path}`, polValidReq.init);
    expect(polValidRes.status).toBe(200);
    const polValidJson = (await polValidRes.json()) as { evaluatedAt?: string };
    expect(polValidJson.evaluatedAt).not.toBe("2025-01-01T00:00:00Z");
    expect(Date.parse(polValidJson.evaluatedAt ?? "")).toBeGreaterThanOrEqual(beforePolMs - 1000);
  });
});
