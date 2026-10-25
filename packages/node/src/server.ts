/**
 * Cognate HTTP API Server
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type {
  ActorId,
  Agent,
  CapabilityGrant,
  HashId,
  Model,
  ModelVersionStatus,
  Output,
  Policy,
  Prompt,
  SignedRequestsMode,
  TenantRootKeyEntry,
} from "@cognate/types";
import type { EvaluationContext } from "@cognate/policy";
import type { DomainEvent, EventStore } from "@mcptoolshop/attestia/event-store";
import { getActiveCapabilities, getAgent, hasCapability } from "@cognate/agent-identity";
import {
  RegistryError,
  attestEvaluation,
  attestTransitionVersion,
  validateHashedIdentifiers,
  type RequireEvaluationCitations,
} from "@cognate/model-registry";
import { attestLogOutput, attestLogPrompt } from "@cognate/prompt-store";
import { handleHealth } from "./routes/health.js";
import { handlePolicy } from "./routes/policy.js";
import { handleRegistry } from "./routes/registry.js";
import { EVALUATIONS_PATH, parseEvaluationRequest } from "./routes/evaluations.js";
import { handleIdentity } from "./routes/identity.js";
import { handlePrompts } from "./routes/prompts.js";
import { checkRateLimit, createRateLimitState, type RateLimitConfig } from "./middleware/rate-limit.js";
import {
  MAX_BODY_BYTES,
  TenantRootsConfigError,
  UNIFORM_UNAUTHENTICATED_BODY,
  createReplayStore,
  isJcsCanonicalJsonBytes,
  isValidPublicKeyBase64Url,
  loadTenantRootsConfig,
  normalizeRequestPathname,
  validateSignedRequestsConfig,
  validateTenantRootsList,
  verifySignedRequest,
} from "./middleware/signature.js";
import { saveSnapshots, type SnapshotPaths, type SnapshotState } from "./snapshot.js";
import { checkDeploy, resolveDeployRelease, type ReleaseFailOn } from "./release-gate.js";
import { proveRecordedEvent, proofErrorBody, statusForProof } from "./event-proof.js";
import {
  idMismatch,
  refuseForeignRecord,
  refuseHiddenAgent,
  refuseHiddenGrant,
  refuseHiddenModel,
  refuseHiddenPrompt,
  refuseHiddenVersion,
  type Refusal,
} from "./tenant.js";

export interface ServerState extends SnapshotState {}

export interface AuthLogEntry {
  readonly level: "warn";
  readonly method: string;
  readonly pathname: string;
  readonly agentId: string;
  readonly code: string;
  readonly reason?: string;
}

export interface ServerContext {
  readonly state: ServerState;
  readonly port: number;
  readonly host: string;
  /**
   * Attestia's append-only log. The governance acts append here.
   * `readAll` serves the inclusion proof. A store without it cannot prove.
   */
  readonly eventStore: Pick<EventStore, "append"> & Partial<Pick<EventStore, "readAll">>;
  /** Registry, grants, and prompts. Absent in tests that do not restart. */
  readonly snapshots?: SnapshotPaths;
  /**
   * RepoMesh release check. The process entry wires this. Tests omit it.
   * The second argument is the release name on the deploy request.
   */
  readonly verifyRelease?: (repo: string, version: string) => Promise<{ status: string }>;
  /** `fail` allows UNVERIFIED. Omission allows only PASS. */
  readonly releaseFailOn?: ReleaseFailOn;
  /**
   * Which version transitions must cite recorded evaluations: `false` (default, none), `"decisions"` (approve and
   * reject) or `"all"`. The entry point reads it from COGNATE_REQUIRE_EVALUATION_CITATIONS.
   */
  readonly requireEvaluationCitations?: RequireEvaluationCitations;
  /**
   * Request signature enforcement mode: `"enforce"` (default) or `"log"`.
   * `"log"` requires `signedRequestsLogUntil` set to a future RFC 3339 UTC timestamp at most 14 days away.
   */
  readonly signedRequests?: SignedRequestsMode;
  /**
   * Mandatory RFC 3339 UTC sunset timestamp when `signedRequests === "log"`.
   */
  readonly signedRequestsLogUntil?: string;
  /**
   * Optional explicit per-tenant root public key entries supplied by the operator.
   */
  readonly tenantRoots?: readonly TenantRootKeyEntry[];
  /**
   * Optional path to an operator-supplied per-tenant root public key JSON configuration file
   * (or set `COGNATE_TENANT_ROOTS_PATH`). Required in `"enforce"` mode when `tenantRoots` is not passed.
   */
  readonly tenantRootsPath?: string;
  /**
   * Explicit test-only flag allowing test fixture root keys (`testOnly: true` or test-seed keys).
   */
  readonly allowTestOnlyRoots?: boolean;
  /**
   * Optional server-side callback for sanitized authentication and `log`-mode warnings.
   */
  readonly onAuthLog?: (entry: AuthLogEntry) => void;
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
  "/events": { maxTokens: 100, refillRate: 10 },
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

type RawBodyReadResult =
  | { readonly ok: true; readonly body: Buffer }
  | { readonly ok: false };

function readRawBody(req: IncomingMessage): Promise<RawBodyReadResult> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    req.on("data", (chunk: Buffer | string) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
      total += buf.length;
      if (total > MAX_BODY_BYTES) {
        settled = true;
        resolve({ ok: false });
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      if (!settled) {
        settled = true;
        resolve({ ok: true, body: Buffer.concat(chunks) });
      }
    });
    req.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendActorMismatch(res: ServerResponse, field: string): void {
  sendJson(res, 403, {
    error: "auth.actor-mismatch",
    code: "auth.actor-mismatch",
    message: `${field} must match the authenticated signer.`,
    hint: "Sign the request with the key belonging to the actor named in the request body.",
  });
}

function checkHashedValue(res: ServerResponse, value: unknown, fieldPath: string): boolean {
  if (typeof value !== "string") return false;
  try {
    validateHashedIdentifiers(value, fieldPath);
    return false;
  } catch {
    sendJson(res, 400, {
      error: "PLAINTEXT_ACCOUNT_IDENTIFIER",
      code: "PLAINTEXT_ACCOUNT_IDENTIFIER",
      message: `Field '${fieldPath}' contains a plaintext account identifier. Sensitive fields must be hashed (e.g., 'sha256:...') before recording in the governance registry.`,
      hint: "Hash PII, file paths, emails, and raw identifiers with SHA-256 before passing to the registry.",
    });
    return true;
  }
}

const NOT_FOUND_CODES = new Set([
  "VERSION_NOT_FOUND",
  "MODEL_NOT_FOUND",
  "store.prompt-not-found",
  "identity.agent-not-found",
  "identity.grant-not-found",
  "vc.grant-not-found",
]);

function statusFor(code: string | undefined): number {
  if (code === "attestia.append-failed") return 503;
  if (code !== undefined && code.startsWith("auth.")) return 403;
  return code !== undefined && NOT_FOUND_CODES.has(code) ? 404 : 400;
}

/** Sends the first refusal, if any. True when the request was answered. */
function refused(res: ServerResponse, ...checks: Array<Refusal | null>): boolean {
  const first = checks.find((c): c is Refusal => c !== null);
  if (first === undefined) return false;
  sendJson(res, first.status, first.body);
  return true;
}

function watchAppends(
  store: Pick<EventStore, "append">,
  unsigned = false,
): {
  eventId: () => string;
  eventStore: Pick<EventStore, "append">;
} {
  let eventId = "";
  return {
    eventId: () => eventId,
    eventStore: {
      append(streamId, events, options) {
        const decorated = unsigned
          ? events.map((ev) => ({
              ...ev,
              payload: { ...(ev.payload as Record<string, unknown>), unsigned: true },
            }))
          : events;
        const first = decorated[0] as DomainEvent | undefined;
        eventId = first?.metadata.eventId ?? "";
        return store.append(streamId, decorated, options);
      },
    },
  };
}

export function createCognateServer(ctx: ServerContext) {
  const { mode: signedRequestsMode, logUntilMs } = validateSignedRequestsConfig(
    ctx.signedRequests ?? "enforce",
    ctx.signedRequestsLogUntil,
  );
  const allowTestOnlyRoots =
    ctx.allowTestOnlyRoots === true || process.env.COGNATE_ALLOW_TEST_ONLY_ROOTS === "true";
  let tenantRoots: readonly TenantRootKeyEntry[];
  if (ctx.tenantRoots !== undefined) {
    tenantRoots = validateTenantRootsList(ctx.tenantRoots, { allowTestOnlyRoots });
    if (signedRequestsMode === "enforce" && tenantRoots.length === 0) {
      throw new TenantRootsConfigError({
        code: "auth.missing-tenant-roots",
        message: "At least one tenant root public key is required in enforce mode.",
        hint: "Supply non-empty tenantRoots, tenantRootsPath, or COGNATE_TENANT_ROOTS_PATH.",
      });
    }
  } else if (
    ctx.tenantRootsPath !== undefined ||
    (process.env.COGNATE_TENANT_ROOTS_PATH?.trim() ?? "") !== "" ||
    signedRequestsMode === "enforce"
  ) {
    tenantRoots = loadTenantRootsConfig(ctx.tenantRootsPath, {
      allowTestOnlyRoots,
      requireNonEmpty: signedRequestsMode === "enforce",
    });
  } else {
    tenantRoots = [];
  }
  const replayStore = createReplayStore();

  const mutableState: ServerState = {
    registry: ctx.state.registry,
    identity: ctx.state.identity,
    prompts: ctx.state.prompts,
  };

  function keep(next: ServerState): void {
    const previous: ServerState = {
      registry: mutableState.registry,
      identity: mutableState.identity,
      prompts: mutableState.prompts,
    };
    mutableState.registry = next.registry;
    mutableState.identity = next.identity;
    mutableState.prompts = next.prompts;
    if (!ctx.snapshots) return;
    try {
      saveSnapshots(ctx.snapshots, mutableState);
    } catch (err) {
      mutableState.registry = previous.registry;
      mutableState.identity = previous.identity;
      mutableState.prompts = previous.prompts;
      throw err;
    }
  }

  const server = createServer(async (req, res) => {
    const rawUrl = req.url ?? "/";
    const method = req.method ?? "GET";
    const normalizedPath = normalizeRequestPathname(rawUrl);
    if (!normalizedPath.ok) {
      sendJson(res, 400, normalizedPath.error);
      return;
    }
    const pathname = normalizedPath.pathname;

    try {
      const rawRead = await readRawBody(req);
      if (!rawRead.ok) {
        sendJson(res, 413, {
          error: "auth.body-too-large",
          code: "auth.body-too-large",
          message: "Request body exceeds 1 MiB limit.",
        });
        return;
      }
      const rawBody = rawRead.body;

      if (pathname === "/health" && method === "GET") {
        handleHealth(res);
        return;
      }

      if (method === "GET" && !pathname.startsWith("/events/") && req.headers["x-agent-id"] === undefined) {
        sendJson(res, 404, { error: "Not found", path: pathname, method });
        return;
      }

      if (pathname.startsWith("/events/") && method === "GET") {
        let eventId = pathname.slice("/events/".length);
        try {
          eventId = decodeURIComponent(eventId);
        } catch {
          sendJson(res, 404, { error: "Not found", path: pathname, method });
          return;
        }
        if (eventId.length === 0 || eventId.includes("/")) {
          sendJson(res, 404, { error: "Not found", path: pathname, method });
          return;
        }
        const authResult = verifySignedRequest({
          method,
          rawUrl,
          headers: req.headers,
          rawBody,
          identity: mutableState.identity,
          tenantRoots,
          replayStore,
          mode: signedRequestsMode,
          logUntilMs,
          onLogModeWarning: (entry) => ctx.onAuthLog?.({ level: "warn", ...entry }),
        });
        if (!authResult.ok) {
          ctx.onAuthLog?.({
            level: "warn",
            method,
            pathname,
            agentId: typeof req.headers["x-agent-id"] === "string" ? req.headers["x-agent-id"] : "",
            code: "auth.unauthenticated",
            reason: authResult.reason,
          });
          sendJson(res, 401, UNIFORM_UNAUTHENTICATED_BODY);
          return;
        }
        const rateResult = checkRateLimitForAgent(authResult.principal.agentId, pathname, Date.now());
        if (!rateResult.allowed) {
          res.writeHead(429, {
            "Content-Type": "application/json",
            "Retry-After": String(rateResult.retryAfter ?? 60),
          });
          res.end(
            JSON.stringify({
              error: "rate-limit.exceeded",
              message: "Rate limit exceeded",
              retryAfter: rateResult.retryAfter,
            }),
          );
          return;
        }
        if (!ctx.eventStore.readAll) {
          sendJson(res, 503, {
            code: "attestia.read-not-configured",
            message: "The event log cannot be read.",
            hint: "The process wires an Attestia store that can read the log.",
          });
          return;
        }
        let recorded;
        try {
          recorded = ctx.eventStore.readAll();
        } catch (err) {
          sendJson(res, 503, {
            code: "attestia.read-failed",
            message: `Attestia read failed: ${err instanceof Error ? err.message : String(err)}`,
            hint: "The event was not returned.",
          });
          return;
        }
        const tenantId = authResult.principal.tenantId;
        const proved = proveRecordedEvent(recorded, eventId, tenantId);
        if (!proved.ok) {
          sendJson(res, statusForProof(proved.code), proofErrorBody(proved.code));
          return;
        }
        sendJson(res, 200, {
          event: proved.event,
          proof: proved.proof,
          root: proved.root,
          leafCount: proved.leafCount,
        });
        return;
      }

      if (method !== "POST") {
        const authResult = verifySignedRequest({
          method,
          rawUrl,
          headers: req.headers,
          rawBody,
          identity: mutableState.identity,
          tenantRoots,
          replayStore,
          mode: signedRequestsMode,
          logUntilMs,
          onLogModeWarning: (entry) => ctx.onAuthLog?.({ level: "warn", ...entry }),
        });
        if (!authResult.ok) {
          ctx.onAuthLog?.({
            level: "warn",
            method,
            pathname,
            agentId: typeof req.headers["x-agent-id"] === "string" ? req.headers["x-agent-id"] : "",
            code: "auth.unauthenticated",
            reason: authResult.reason,
          });
          sendJson(res, 401, UNIFORM_UNAUTHENTICATED_BODY);
          return;
        }
        sendJson(res, 404, { error: "Not found", path: pathname, method });
        return;
      }

      const authResult = verifySignedRequest({
        method,
        rawUrl,
        headers: req.headers,
        rawBody,
        identity: mutableState.identity,
        tenantRoots,
        replayStore,
        mode: signedRequestsMode,
        logUntilMs,
        onLogModeWarning: (entry) => ctx.onAuthLog?.({ level: "warn", ...entry }),
      });
      if (!authResult.ok) {
        ctx.onAuthLog?.({
          level: "warn",
          method,
          pathname,
          agentId: typeof req.headers["x-agent-id"] === "string" ? req.headers["x-agent-id"] : "",
          code: "auth.unauthenticated",
          reason: authResult.reason,
        });
        sendJson(res, 401, UNIFORM_UNAUTHENTICATED_BODY);
        return;
      }

      const caller = authResult.principal;
      const actorId = caller.actorId;
      const tenantId = caller.tenantId;

      const rawText = rawBody.toString("utf8");
      let body: unknown = {};
      if (rawText.length > 0) {
        try {
          body = JSON.parse(rawText);
        } catch {
          throw new Error("Invalid JSON");
        }
      }

      if (!caller.unsigned) {
        if (rawBody.length === 0 || !isJcsCanonicalJsonBytes(rawBody, body)) {
          sendJson(res, 400, {
            error: "auth.body-not-canonical",
            code: "auth.body-not-canonical",
            message: "Signed POST body must be RFC 8785 JCS-canonical UTF-8.",
            hint: "Canonicalize the JSON body with RFC 8785 (JCS) before hashing and signing.",
          });
          return;
        }
      }

      const rateResult = checkRateLimitForAgent(caller.agentId, pathname, Date.now());
      if (!rateResult.allowed) {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": String(rateResult.retryAfter ?? 60),
        });
        res.end(
          JSON.stringify({
            error: "rate-limit.exceeded",
            message: "Rate limit exceeded",
            retryAfter: rateResult.retryAfter,
          }),
        );
        return;
      }

      if (pathname === "/policy/evaluate" && method === "POST") {
        const reqBody = body as { policy?: Policy; context?: EvaluationContext };
        if (
          reqBody.policy &&
          reqBody.context &&
          refused(
            res,
            refuseForeignRecord("policy", "context", reqBody.context, tenantId),
            refuseForeignRecord("policy", "policy", reqBody.policy, tenantId),
          )
        ) {
          return;
        }
        if (reqBody.policy && reqBody.context) {
          if (reqBody.context.actorId !== undefined && reqBody.context.actorId !== actorId) {
            sendActorMismatch(res, "context.actorId");
            return;
          }
          if (checkHashedValue(res, actorId, "context.actorId")) return;
          if (
            reqBody.policy.approvedBy !== null &&
            reqBody.policy.approvedBy !== undefined &&
            checkHashedValue(res, reqBody.policy.approvedBy, "policy.approvedBy")
          ) {
            return;
          }

          let verifiedContext: EvaluationContext = {
            ...reqBody.context,
            actorId,
          };

          if (reqBody.context.agentId !== null && reqBody.context.agentId !== undefined) {
            if (reqBody.context.agentId !== caller.agentId) {
              sendActorMismatch(res, "context.agentId");
              return;
            }
            const ctxAgent = getAgent(mutableState.identity, reqBody.context.agentId);
            if (!ctxAgent || ctxAgent.tenantId !== tenantId) {
              sendActorMismatch(res, "context.agentId");
              return;
            }
            const activeCaps = getActiveCapabilities(
              mutableState.identity,
              ctxAgent.id,
              (reqBody.context.timestamp ?? new Date().toISOString()) as import("@cognate/types").Timestamp,
            );
            const activeKinds = new Set(activeCaps.map((c) => c.kind));
            if (
              Array.isArray(reqBody.context.agentCapabilities) &&
              reqBody.context.agentCapabilities.some((cap) => !activeKinds.has(cap.kind ?? (cap as unknown as import("@cognate/types").CapabilityKind)))
            ) {
              sendActorMismatch(res, "context.agentCapabilities");
              return;
            }
            verifiedContext = {
              ...verifiedContext,
              agentId: ctxAgent.id,
              agentCapabilities: activeCaps,
            };
          } else if (Array.isArray(reqBody.context.agentCapabilities) && reqBody.context.agentCapabilities.length > 0) {
            sendActorMismatch(res, "context.agentCapabilities");
            return;
          }

          const watched = watchAppends(ctx.eventStore, caller.unsigned);
          await handlePolicy(res, { policy: reqBody.policy, context: verifiedContext }, watched.eventStore);
          return;
        }
        await handlePolicy(res, body, ctx.eventStore);
        return;
      }

      if (pathname === "/registry/models" && method === "POST") {
        const model = (body as { model?: Model }).model;
        if (refused(res, refuseForeignRecord("registry", "model", model, tenantId))) return;
        if (model) {
          if (model.owner !== undefined && model.owner !== actorId) {
            sendActorMismatch(res, "model.owner");
            return;
          }
          if (checkHashedValue(res, model.owner, "model.owner")) return;
          if (checkHashedValue(res, model.name, "model.name")) return;
        }
        const result = handleRegistry(mutableState, pathname, method, body);
        if (!result.ok || !result.state) {
          sendJson(res, 400, result.error);
          return;
        }
        keep({ ...mutableState, registry: result.state });
        sendJson(res, 200, result.value);
        return;
      }

      const evaluationsPath = method === "POST" ? EVALUATIONS_PATH.exec(pathname) : null;
      if (evaluationsPath) {
        const versionId = evaluationsPath[1] ?? "";
        const parsed = parseEvaluationRequest(body, versionId, tenantId);
        if (!parsed.ok) {
          sendJson(res, 400, parsed.error);
          return;
        }
        if (refused(res, refuseHiddenVersion(mutableState, versionId, tenantId))) return;
        if (parsed.evaluation.evaluator !== actorId) {
          sendActorMismatch(res, "evaluation.evaluator");
          return;
        }
        if (checkHashedValue(res, parsed.evaluation.evaluator, "evaluation.evaluator")) return;
        const watched = watchAppends(ctx.eventStore, caller.unsigned);
        try {
          const next = await attestEvaluation(
            mutableState.registry,
            { eventStore: watched.eventStore, tenantId },
            parsed.evaluation,
          );
          keep({ ...mutableState, registry: next });
          sendJson(res, 201, { evaluationId: parsed.evaluation.id, versionId, eventId: watched.eventId() });
        } catch (err) {
          if (err instanceof RegistryError) {
            sendJson(res, statusFor(err.code), { code: err.code, message: err.message, hint: err.hint });
            return;
          }
          throw err;
        }
        return;
      }

      if (pathname.startsWith("/registry/versions/") && method === "POST") {
        const parts = pathname.split("/");
        const versionId = parts[3] ?? "";
        const transition = body as {
          version?: unknown;
          from?: ModelVersionStatus;
          to?: ModelVersionStatus;
          actorId?: string;
          reason?: string;
          evaluationIds?: unknown;
          repo?: unknown;
          release?: unknown;
        };
        if (transition.from && transition.to && transition.actorId && transition.reason && !transition.version) {
          // Actor binding (Ruling 1): body actorId must match the verified signer before any check or append.
          if (transition.actorId !== actorId) {
            sendActorMismatch(res, "transition.actorId");
            return;
          }
          // Under PR (a), any sign-off-gated action must be signed by the authorizing principal itself.
          if (caller.agent) {
            for (const cap of caller.agent.capabilities) {
              for (const constraint of cap.constraints ?? []) {
                if (
                  constraint.kind === "approval-required" &&
                  Array.isArray(constraint.approvers) &&
                  !constraint.approvers.includes(actorId)
                ) {
                  sendActorMismatch(res, "transition.actorId");
                  return;
                }
              }
            }
          }
          if (checkHashedValue(res, transition.actorId, "transition.actorId")) return;
          // A citation the server can't read is refused, never dropped: an uncited move would go through instead.
          if (
            transition.evaluationIds !== undefined &&
            (!Array.isArray(transition.evaluationIds) ||
              !transition.evaluationIds.every((id) => typeof id === "string"))
          ) {
            sendJson(res, 400, {
              code: "registry.invalid-evaluation-ids",
              message: "evaluationIds must be an array of evaluation id strings.",
              hint: "Pass the recorded evaluation ids as an array of strings, or omit evaluationIds.",
            });
            return;
          }
          // Before RepoMesh or any append: another tenant's version is answered as a missing one.
          if (refused(res, refuseHiddenVersion(mutableState, versionId, tenantId))) return;
          const stored = mutableState.registry.versions[versionId];
          // Only an approved version moving to deployed is checked. Other transitions never call RepoMesh.
          const deploying =
            transition.from === "approved" &&
            transition.to === "deployed" &&
            stored?.status === "approved";

          let releaseEventId: string | undefined;
          let releaseStatus: string | undefined;
          if (deploying && stored) {
            const bound = resolveDeployRelease(stored, transition);
            if (!bound.ok) {
              sendJson(
                res,
                400,
                bound.code === "repomesh.missing-release"
                  ? {
                      code: bound.code,
                      message: "This version has no repo and release.",
                      hint: "Record repo and release on the version when it is registered.",
                    }
                  : {
                      code: bound.code,
                      message: "The request names a different repo or release than the version.",
                      hint: "Deploy checks the pair stored on the version.",
                    },
              );
              return;
            }
            const repo = bound.repo;
            const release = bound.release;
            if (!ctx.verifyRelease) {
              sendJson(res, 503, {
                code: "repomesh.not-configured",
                message: "RepoMesh verification is not configured.",
                hint: "The process wires verifyRelease before a version can deploy.",
              });
              return;
            }
            const deployWatched = watchAppends(ctx.eventStore, caller.unsigned);
            const checked = await checkDeploy({
              eventStore: deployWatched.eventStore,
              verifyRelease: ctx.verifyRelease,
              failOn: ctx.releaseFailOn ?? "unverified",
              tenantId,
              actorId: transition.actorId,
              modelVersionId: versionId,
              repo,
              release,
            });
            if (checked.kind === "check-failed") {
              sendJson(res, 503, {
                code: "repomesh.check-failed",
                message: checked.message,
                hint: "The release was not checked. The version stays approved.",
              });
              return;
            }
            if (checked.kind === "append-failed") {
              sendJson(res, 503, {
                code: "attestia.append-failed",
                message: checked.message,
                hint: "The release check was not recorded. The version stays approved.",
              });
              return;
            }
            if (!checked.accepted) {
              sendJson(res, 409, {
                code: "repomesh.release-denied",
                message: "The release did not pass. The version stays approved.",
                hint: "A PASS deploys. UNVERIFIED deploys only when REPOMESH_FAIL_ON is fail.",
                status: checked.status,
                repo: checked.repo,
                release: checked.release,
                eventId: checked.eventId,
              });
              return;
            }
            releaseEventId = checked.eventId;
            releaseStatus = checked.status;
          }

          const watched = watchAppends(ctx.eventStore, caller.unsigned);
          try {
            const next = await attestTransitionVersion(
              mutableState.registry,
              { eventStore: watched.eventStore, tenantId },
              versionId,
              transition.from,
              transition.to,
              transition.actorId,
              transition.reason,
              {
                requireEvaluationCitations: ctx.requireEvaluationCitations ?? false,
                ...(Array.isArray(transition.evaluationIds)
                  ? { evaluationIds: transition.evaluationIds.map((id) => String(id)) }
                  : {}),
              },
            );
            keep({ ...mutableState, registry: next });
            sendJson(res, 200, {
              versionId,
              to: transition.to,
              eventId: watched.eventId(),
              ...(releaseEventId !== undefined ? { releaseEventId, releaseStatus } : {}),
            });
          } catch (err) {
            if (err instanceof RegistryError) {
              sendJson(res, statusFor(err.code), { code: err.code, message: err.message, hint: err.hint });
              return;
            }
            throw err;
          }
          return;
        }
        const registering = (body as { version?: { id?: unknown; tenantId?: unknown; modelId?: unknown } }).version;
        if (
          registering &&
          parts.length === 4 &&
          refused(
            res,
            registering.id === versionId
              ? null
              : idMismatch("registry.version-id-mismatch", "The version's id is not the id in the path."),
            refuseForeignRecord("registry", "version", registering, tenantId),
            refuseHiddenModel(mutableState, String(registering.modelId), tenantId),
          )
        ) {
          return;
        }
        const result = handleRegistry(mutableState, pathname, method, body);
        if (!result.ok || !result.state) {
          sendJson(res, statusFor(result.error?.code), result.error);
          return;
        }
        keep({ ...mutableState, registry: result.state });
        sendJson(res, 200, result.value);
        return;
      }

      if (pathname === "/identity/agents" && method === "POST") {
        const agent = (body as { agent?: Agent }).agent;
        if (refused(res, refuseForeignRecord("identity", "agent", agent, tenantId))) {
          return;
        }
        if (agent) {
          if (agent.owner !== undefined && agent.owner !== actorId) {
            sendActorMismatch(res, "agent.owner");
            return;
          }
          if (checkHashedValue(res, agent.id, "agent.id")) return;
          if (checkHashedValue(res, agent.owner, "agent.owner")) return;
          if (checkHashedValue(res, agent.name, "agent.name")) return;

          if (!agent.publicKey || !isValidPublicKeyBase64Url(agent.publicKey)) {
            sendJson(res, 400, {
              error: "identity.invalid-public-key",
              code: "identity.invalid-public-key",
              message: "Agent must be registered with a valid 43-character base64url Ed25519 publicKey.",
              hint: "Generate an Ed25519 key pair and provide the base64url publicKey.",
            });
            return;
          }

          const tenantHasDelegate = Array.from(mutableState.identity.agents.values()).some(
            (existing) =>
              existing.tenantId === tenantId &&
              existing.capabilities.some((c) => c.kind === "delegate"),
          );

          if (caller.isTenantRoot) {
            if (tenantHasDelegate) {
              sendJson(res, 403, {
                error: "auth.bootstrap-already-completed",
                code: "auth.bootstrap-already-completed",
                message: "Tenant root key bootstrap is only permitted for the tenant's first delegate agent.",
                hint: "Use an active delegate principal in the tenant to register additional agents.",
              });
              return;
            }
            const caps = agent.capabilities ?? [];
            const validBootstrapCaps =
              caps.length <= 1 &&
              caps.every((c) => c.kind === "delegate" && (c.grantedBy === undefined || c.grantedBy === actorId));
            if (!validBootstrapCaps) {
              sendJson(res, 403, {
                error: "auth.capabilities-not-allowed",
                code: "auth.capabilities-not-allowed",
                message: "Root bootstrap may only pre-populate the initial delegate capability.",
                hint: "Grant additional capabilities via POST /identity/grants.",
              });
              return;
            }
          } else {
            const nowIso = new Date().toISOString() as import("@cognate/types").Timestamp;
            if (!hasCapability(mutableState.identity, caller.agentId, "delegate", nowIso)) {
              sendJson(res, 403, {
                error: "auth.missing-capability",
                code: "auth.missing-capability",
                message: "Registering an agent requires the delegate capability.",
                hint: "Sign the request with an active delegate principal.",
              });
              return;
            }
            if (Array.isArray(agent.capabilities) && agent.capabilities.length > 0) {
              sendJson(res, 403, {
                error: "auth.capabilities-not-allowed",
                code: "auth.capabilities-not-allowed",
                message: "Pre-populated agent capabilities are refused; capabilities come only through grants.",
                hint: "Register the agent with capabilities: [] and use POST /identity/grants.",
              });
              return;
            }
            if (agent.principal === "human" && caller.principal !== "human") {
              sendJson(res, 403, {
                error: "auth.escalation-forbidden",
                code: "auth.escalation-forbidden",
                message: "An agent principal cannot register a human principal.",
                hint: "Human principals must be registered by an active human delegate or the tenant root key.",
              });
              return;
            }
          }
        }
        const result = handleIdentity(mutableState, pathname, method, body);
        if (!result.ok || !result.state) {
          sendJson(res, statusFor(result.error?.code), result.error);
          return;
        }
        keep({ ...mutableState, identity: result.state });
        sendJson(res, 201, result.value);
        return;
      }

      if (pathname.startsWith("/identity/agents/") && (pathname.endsWith("/key") || pathname.endsWith("/revoke")) && method === "POST") {
        const targetAgentId = pathname.split("/")[3] ?? "";
        if (refused(res, refuseHiddenAgent(mutableState, targetAgentId, tenantId))) {
          return;
        }
        const target = getAgent(mutableState.identity, targetAgentId as ActorId)!;
        if (pathname.endsWith("/key")) {
          if (target.principal === "human") {
            if (actorId !== target.id && !caller.isTenantRoot) {
              sendJson(res, 403, {
                error: "auth.escalation-forbidden",
                code: "auth.escalation-forbidden",
                message: "A human principal's key cannot be rotated by its owner; only the human's own current key or the tenant root can rotate it.",
                hint: "Sign the key rotation request with the human principal's own current key or the tenant root key.",
              });
              return;
            }
          } else if (actorId !== target.id && actorId !== target.owner && !caller.isTenantRoot) {
            sendJson(res, 403, {
              error: "auth.escalation-forbidden",
              code: "auth.escalation-forbidden",
              message: "Only the agent itself, its owner, or the tenant root key can rotate its key.",
              hint: "Sign the request with the agent's current key, its owner's key, or the tenant root key.",
            });
            return;
          }
        } else {
          // /revoke
          if (target.principal === "human") {
            const isHumanDelegate =
              caller.principal === "human" &&
              hasCapability(
                mutableState.identity,
                caller.agentId,
                "delegate",
                new Date().toISOString() as import("@cognate/types").Timestamp,
              );
            if (actorId !== target.id && !caller.isTenantRoot && !isHumanDelegate) {
              sendJson(res, 403, {
                error: "auth.escalation-forbidden",
                code: "auth.escalation-forbidden",
                message: "An agent cannot revoke a human principal.",
                hint: "Human revocation requires the human's own key, an active human delegate, or the tenant root key.",
              });
              return;
            }
          } else {
            const hasDel = hasCapability(
              mutableState.identity,
              caller.agentId,
              "delegate",
              new Date().toISOString() as import("@cognate/types").Timestamp,
            );
            if (actorId !== target.id && actorId !== target.owner && !caller.isTenantRoot && !hasDel) {
              sendJson(res, 403, {
                error: "auth.escalation-forbidden",
                code: "auth.escalation-forbidden",
                message: "Not authorized to revoke this agent.",
                hint: "Sign the request with the agent's key, its owner's key, an active delegate, or the tenant root key.",
              });
              return;
            }
          }
        }

        const result = handleIdentity(mutableState, pathname, method, body);
        if (!result.ok || !result.state) {
          sendJson(res, statusFor(result.error?.code), result.error);
          return;
        }
        keep({ ...mutableState, identity: result.state });
        sendJson(res, 200, result.value);
        return;
      }

      if ((pathname === "/identity/grants" || pathname.startsWith("/identity/grants/")) && method === "POST") {
        const grantId = pathname.split("/")[3] ?? "";
        const requested = (body as { grant?: CapabilityGrant }).grant;
        const approving = body as { approverId?: unknown; timestamp?: unknown };
        if (
          (pathname === "/identity/grants" &&
            requested !== undefined &&
            refused(
              res,
              refuseForeignRecord("identity", "grant", requested, tenantId),
              refuseHiddenAgent(mutableState, String(requested.agentId), tenantId),
            )) ||
          (pathname.endsWith("/approve") &&
            grantId !== "" &&
            Boolean(approving.approverId) &&
            Boolean(approving.timestamp) &&
            refused(res, refuseHiddenGrant(mutableState, grantId, tenantId, "approve"))) ||
          (pathname.endsWith("/vc") &&
            grantId !== "" &&
            refused(res, refuseHiddenGrant(mutableState, grantId, tenantId, "vc")))
        ) {
          return;
        }

        if (pathname === "/identity/grants" && requested !== undefined) {
          if (requested.requestedBy !== actorId) {
            sendActorMismatch(res, "grant.requestedBy");
            return;
          }
          if (requested.capability?.grantedBy !== undefined && requested.capability.grantedBy !== actorId) {
            sendActorMismatch(res, "grant.capability.grantedBy");
            return;
          }
          if (checkHashedValue(res, requested.requestedBy, "grant.requestedBy")) return;
          if (
            requested.status !== "pending" ||
            requested.approvedBy !== null ||
            (requested.approvedAt !== null && requested.approvedAt !== undefined)
          ) {
            sendJson(res, 400, {
              error: "identity.grant-not-pending",
              code: "identity.grant-not-pending",
              message: "A new grant must have status 'pending' and approvedBy null.",
              hint: "Submit new grants with status: 'pending', approvedBy: null, and approvedAt: null.",
            });
            return;
          }
          if (requested.capability?.kind === "delegate" && caller.principal !== "human" && !caller.isTenantRoot) {
            sendJson(res, 403, {
              error: "auth.escalation-forbidden",
              code: "auth.escalation-forbidden",
              message: "An agent principal cannot grant the delegate capability.",
              hint: "Only an active human delegate or the tenant root key can grant delegate.",
            });
            return;
          }
        }

        if (pathname.endsWith("/approve") && grantId !== "" && Boolean(approving.approverId) && Boolean(approving.timestamp)) {
          if (approving.approverId !== actorId) {
            sendActorMismatch(res, "approverId");
            return;
          }
          if (checkHashedValue(res, approving.approverId, "approverId")) return;
          const storedGrant = mutableState.identity.grants.get(grantId as HashId);
          if (storedGrant && actorId === storedGrant.agentId) {
            sendJson(res, 403, {
              error: "auth.self-approval-forbidden",
              code: "auth.self-approval-forbidden",
              message: "A principal cannot approve a capability grant for itself.",
              hint: "Have another authorized delegate approve the grant.",
            });
            return;
          }
          if (
            !caller.isTenantRoot &&
            !hasCapability(
              mutableState.identity,
              caller.agentId,
              "delegate",
              String(approving.timestamp) as import("@cognate/types").Timestamp,
            )
          ) {
            sendJson(res, 403, {
              error: "auth.missing-capability",
              code: "auth.missing-capability",
              message: "Approving a capability grant requires the delegate capability.",
              hint: "Sign the approval with an active delegate principal.",
            });
            return;
          }
          if (storedGrant && storedGrant.capability.kind === "delegate" && caller.principal !== "human" && !caller.isTenantRoot) {
            sendJson(res, 403, {
              error: "auth.escalation-forbidden",
              code: "auth.escalation-forbidden",
              message: "An agent principal cannot grant the delegate capability.",
              hint: "Only an active human delegate or the tenant root key can grant delegate.",
            });
            return;
          }
        }

        const result = handleIdentity(mutableState, pathname, method, body);
        if (!result.ok || !result.state) {
          sendJson(res, result.ok ? 200 : statusFor(result.error?.code), result.ok ? result.value : result.error);
          return;
        }
        keep({ ...mutableState, identity: result.state });
        sendJson(res, 200, result.value);
        return;
      }

      if (pathname === "/prompts" && method === "POST") {
        const prompt = (body as { prompt?: Prompt }).prompt;
        if (!prompt) {
          const result = handlePrompts(mutableState, pathname, method, body);
          sendJson(res, 400, result.error);
          return;
        }
        if (refused(res, refuseForeignRecord("prompts", "prompt", prompt, tenantId))) return;
        if (prompt.agentId !== null && prompt.agentId !== undefined && prompt.agentId !== actorId) {
          sendActorMismatch(res, "prompt.agentId");
          return;
        }
        if (checkHashedValue(res, actorId, "prompt.agentId")) return;
        const boundPrompt: Prompt = { ...prompt, agentId: actorId };
        const watched = watchAppends(ctx.eventStore, caller.unsigned);
        const result = await attestLogPrompt(
          mutableState.prompts,
          { eventStore: watched.eventStore, tenantId: boundPrompt.tenantId, actorId },
          boundPrompt,
        );
        if (!result.ok) {
          sendJson(res, statusFor(result.error.code), result.error);
          return;
        }
        keep({ ...mutableState, prompts: result.state });
        sendJson(res, 201, { id: boundPrompt.id, eventId: watched.eventId() });
        return;
      }

      if (pathname.startsWith("/prompts/") && pathname.endsWith("/outputs") && method === "POST") {
        const output = (body as { output?: Output }).output;
        if (!output) {
          const result = handlePrompts(mutableState, pathname, method, body);
          sendJson(res, 400, result.error);
          return;
        }
        const promptId = pathname.split("/")[2] ?? "";
        if (
          refused(
            res,
            output.promptId === promptId
              ? null
              : idMismatch("prompts.prompt-id-mismatch", "The output's promptId is not the prompt id in the path."),
            refuseForeignRecord("prompts", "output", output, tenantId),
            refuseHiddenPrompt(mutableState, String(output.promptId), tenantId),
          )
        ) {
          return;
        }
        if (checkHashedValue(res, actorId, "output.actorId")) return;
        const watched = watchAppends(ctx.eventStore, caller.unsigned);
        const result = await attestLogOutput(
          mutableState.prompts,
          { eventStore: watched.eventStore, tenantId: output.tenantId, actorId },
          output,
        );
        if (!result.ok) {
          sendJson(res, statusFor(result.error.code), result.error);
          return;
        }
        keep({ ...mutableState, prompts: result.state });
        sendJson(res, 201, { id: output.id, promptId: output.promptId, eventId: watched.eventId() });
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

export {
  EMPTY_BODY_SHA256,
  MAX_BODY_BYTES,
  MAX_LOG_MODE_SUNSET_MS,
  TIMESTAMP_WINDOW_MS,
  TenantRootsConfigError,
  UNIFORM_UNAUTHENTICATED_BODY,
  buildCanonicalRequestString,
  canonicalizeJsonBody,
  createReplayStore,
  deriveKid,
  generateEd25519KeyPair,
  isJcsCanonicalJsonBytes,
  isValidAgentIdHeader,
  isValidKeyIdHeader,
  isValidNonceHeader,
  isValidPublicKeyBase64Url,
  isValidRequestMethod,
  isValidRequestPath,
  isValidSignatureHeader,
  isValidTimestampHeader,
  loadTenantRootsConfig,
  normalizeRequestPathname,
  sha256HexBytes,
  signCanonicalRequest,
  signedRequestsConfigFromEnv,
  tryDeriveKid,
  validateSignedRequestsConfig,
  validateTenantRootsList,
  verifyCanonicalRequestSignature,
  verifySignedRequest,
  type CanonicalRequestFields,
  type Ed25519KeyPairMaterial,
  type ReplayStore,
  type SignatureAuthResult,
  type VerifiedPrincipal,
} from "./middleware/signature.js";

export {
  createSignedClient,
  signHttpRequest,
  type SignHttpRequestParams,
  type SignedClient,
  type SignedClientOptions,
  type SignedClientRequestOptions,
  type SignedHttpRequest,
} from "./client.js";

