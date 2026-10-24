/**
 * Cognate HTTP API Server
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { ActorId, ModelVersionStatus } from "@cognate/types";
import type { DomainEvent, EventStore } from "@mcptoolshop/attestia/event-store";
import { getAgent } from "@cognate/agent-identity";
import { attestEvaluation, attestTransitionVersion, type RequireEvaluationCitations } from "@cognate/model-registry";
import { RegistryError } from "@cognate/model-registry";
import { attestLogOutput, attestLogPrompt } from "@cognate/prompt-store";
import type { Output, Prompt } from "@cognate/types";
import { handleHealth } from "./routes/health.js";
import { handlePolicy } from "./routes/policy.js";
import { handleRegistry } from "./routes/registry.js";
import { EVALUATIONS_PATH, parseEvaluationRequest } from "./routes/evaluations.js";
import { handleIdentity } from "./routes/identity.js";
import { handlePrompts } from "./routes/prompts.js";
import { authenticate } from "./middleware/auth.js";
import { checkRateLimit, createRateLimitState, type RateLimitConfig } from "./middleware/rate-limit.js";
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

export interface ServerContext {
  readonly state: ServerState;
  readonly port: number;
  readonly host: string;
  /**
   * Attestia's append-only log. The four governance acts append here.
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
  return code !== undefined && NOT_FOUND_CODES.has(code) ? 404 : 400;
}

/** Sends the first refusal, if any. True when the request was answered. */
function refused(res: ServerResponse, ...checks: Array<Refusal | null>): boolean {
  const first = checks.find((c): c is Refusal => c !== null);
  if (first === undefined) return false;
  sendJson(res, first.status, first.body);
  return true;
}

function watchAppends(store: Pick<EventStore, "append">): {
  eventId: () => string;
  eventStore: Pick<EventStore, "append">;
} {
  let eventId = "";
  return {
    eventId: () => eventId,
    eventStore: {
      append(streamId, events, options) {
        const first = events[0] as DomainEvent | undefined;
        eventId = first?.metadata.eventId ?? "";
        return store.append(streamId, events, options);
      },
    },
  };
}

export function createCognateServer(ctx: ServerContext) {
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
    const url = new URL(req.url ?? "/", "http://" + (req.headers.host ?? "localhost"));
    const method = req.method ?? "GET";
    const pathname = url.pathname;

    try {
      const body = await parseBody(req);

      if (pathname === "/health" && method === "GET") {
        handleHealth(res);
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
        const authResult = authenticate(req, { identityState: mutableState.identity });
        if (!authResult.ok) {
          sendJson(res, 401, { error: authResult.code, message: authResult.message });
          return;
        }
        const rateResult = checkRateLimitForAgent(authResult.agent.agentId, pathname, Date.now());
        if (!rateResult.allowed) {
          res.writeHead(429, {
            "Content-Type": "application/json",
            "Retry-After": String(rateResult.retryAfter ?? 60),
          });
          res.end(JSON.stringify({ error: "rate-limit.exceeded", message: "Rate limit exceeded", retryAfter: rateResult.retryAfter }));
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
        const tenantId = getAgent(mutableState.identity, authResult.agent.agentId)?.tenantId ?? "default";
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

      let actorId = "" as ActorId;
      if (method === "POST") {
        const authResult = authenticate(req, { identityState: mutableState.identity });
        if (!authResult.ok) {
          sendJson(res, 401, { error: authResult.code, message: authResult.message });
          return;
        }
        actorId = authResult.agent.agentId;
        const rateResult = checkRateLimitForAgent(actorId, pathname, Date.now());
        if (!rateResult.allowed) {
          res.writeHead(429, {
            "Content-Type": "application/json",
            "Retry-After": String(rateResult.retryAfter ?? 60),
          });
          res.end(JSON.stringify({ error: "rate-limit.exceeded", message: "Rate limit exceeded", retryAfter: rateResult.retryAfter }));
          return;
        }
      }

      // Every POST acts in the authenticated agent's tenant (tenant.ts).
      const tenantId = getAgent(mutableState.identity, actorId)?.tenantId ?? "default";

      if (pathname === "/policy/evaluate" && method === "POST") {
        const req = body as { policy?: { tenantId?: unknown }; context?: { tenantId?: unknown } };
        if (
          req.policy &&
          req.context &&
          refused(
            res,
            refuseForeignRecord("policy", "context", req.context, tenantId),
            refuseForeignRecord("policy", "policy", req.policy, tenantId),
          )
        ) {
          return;
        }
        await handlePolicy(res, body, ctx.eventStore);
        return;
      }

      if (pathname === "/registry/models" && method === "POST") {
        if (refused(res, refuseForeignRecord("registry", "model", (body as { model?: { tenantId?: unknown } }).model, tenantId))) return;
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
        const watched = watchAppends(ctx.eventStore);
        try {
          const next = await attestEvaluation(mutableState.registry, { eventStore: watched.eventStore, tenantId }, parsed.evaluation);
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
          // A citation the server can't read is refused, never dropped: an uncited move would go through instead.
          if (
            transition.evaluationIds !== undefined &&
            (!Array.isArray(transition.evaluationIds) || !transition.evaluationIds.every((id) => typeof id === "string"))
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
              sendJson(res, 400, bound.code === "repomesh.missing-release"
                ? {
                    code: bound.code,
                    message: "This version has no repo and release.",
                    hint: "Record repo and release on the version when it is registered.",
                  }
                : {
                    code: bound.code,
                    message: "The request names a different repo or release than the version.",
                    hint: "Deploy checks the pair stored on the version.",
                  });
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
            const checked = await checkDeploy({
              eventStore: ctx.eventStore,
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

          const watched = watchAppends(ctx.eventStore);
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
        if (refused(res, refuseForeignRecord("identity", "agent", (body as { agent?: { tenantId?: unknown } }).agent, tenantId))) {
          return;
        }
        const result = handleIdentity(mutableState, pathname, method, body);
        if (!result.ok || !result.state) {
          sendJson(res, 400, result.error);
          return;
        }
        keep({ ...mutableState, identity: result.state });
        sendJson(res, 201, result.value);
        return;
      }

      if ((pathname === "/identity/grants" || pathname.startsWith("/identity/grants/")) && method === "POST") {
        const grantId = pathname.split("/")[3] ?? "";
        const requested = (body as { grant?: { tenantId?: unknown; agentId?: unknown } }).grant;
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
          (pathname.endsWith("/vc") && grantId !== "" && refused(res, refuseHiddenGrant(mutableState, grantId, tenantId, "vc")))
        ) {
          return;
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
        const watched = watchAppends(ctx.eventStore);
        const result = await attestLogPrompt(
          mutableState.prompts,
          { eventStore: watched.eventStore, tenantId: prompt.tenantId },
          prompt,
        );
        if (!result.ok) {
          sendJson(res, statusFor(result.error.code), result.error);
          return;
        }
        keep({ ...mutableState, prompts: result.state });
        sendJson(res, 201, { id: prompt.id, eventId: watched.eventId() });
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
        const watched = watchAppends(ctx.eventStore);
        const result = await attestLogOutput(
          mutableState.prompts,
          { eventStore: watched.eventStore, tenantId: output.tenantId },
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
