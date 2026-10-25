import {
  createRegistry as createIdentityRegistry,
  registerAgent,
  requestGrant,
  approveGrant,
  rotateAgentKey,
  revokeAgent,
  exportGrantAsVC,
} from "@cognate/agent-identity";
import type { ActorId, Agent, Capability, CapabilityGrant, HashId, Timestamp } from "@cognate/types";
import type { ServerState } from "../server.js";

interface RouteResult<T> {
  ok: boolean;
  value?: T;
  error?: { code: string; message: string; hint: string };
  state?: ReturnType<typeof createIdentityRegistry>;
}

function normalizeCapabilities(capabilities: readonly Capability[] | undefined): readonly Capability[] {
  if (!Array.isArray(capabilities)) return [];
  return capabilities.map((cap, idx) => ({
    ...cap,
    id: (cap.id ?? `cap-${idx + 1}`) as HashId,
    constraints: Array.isArray(cap.constraints) ? cap.constraints : [],
  }));
}

export function handleIdentity(
  mutableState: ServerState,
  pathname: string,
  method: string,
  body: unknown
): RouteResult<unknown> {
  if (pathname === "/identity/agents" && method === "POST") {
    const req = body as { agent?: Agent };
    if (!req.agent) {
      return { ok: false, error: { code: "identity.missing-agent", message: "Missing agent", hint: "Provide an agent object" } };
    }
    const normalizedAgent: Agent = {
      ...req.agent,
      capabilities: normalizeCapabilities(req.agent.capabilities),
    };
    const result = registerAgent(mutableState.identity, normalizedAgent);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message, hint: result.error.hint } };
    }
    return { ok: true, value: { id: req.agent.id }, state: result.state };
  }

  if (pathname.startsWith("/identity/agents/") && pathname.endsWith("/key") && method === "POST") {
    const parts = pathname.split("/");
    const agentId = parts[3];
    const req = body as { publicKey?: unknown };
    if (!agentId || typeof req.publicKey !== "string" || req.publicKey.length === 0) {
      return {
        ok: false,
        error: {
          code: "identity.missing-public-key",
          message: "Missing agentId or publicKey",
          hint: "Provide a 43-character base64url raw 32-byte Ed25519 publicKey.",
        },
      };
    }
    const result = rotateAgentKey(mutableState.identity, agentId as ActorId, req.publicKey);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message, hint: result.error.hint } };
    }
    return {
      ok: true,
      value: { id: agentId, kid: result.value.kid, publicKey: result.value.publicKey },
      state: result.state,
    };
  }

  if (pathname.startsWith("/identity/agents/") && pathname.endsWith("/revoke") && method === "POST") {
    const parts = pathname.split("/");
    const agentId = parts[3];
    if (!agentId) {
      return {
        ok: false,
        error: {
          code: "identity.missing-agent-id",
          message: "Missing agent ID in URL",
          hint: "Use /identity/agents/:id/revoke",
        },
      };
    }
    const result = revokeAgent(mutableState.identity, agentId as ActorId);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message, hint: result.error.hint } };
    }
    return { ok: true, value: { id: agentId, status: "revoked" }, state: result.state };
  }

  if (pathname === "/identity/grants" && method === "POST") {
    const req = body as { grant?: CapabilityGrant };
    if (!req.grant) {
      return { ok: false, error: { code: "identity.missing-grant", message: "Missing grant", hint: "Provide a grant object" } };
    }
    const normalizedGrant: CapabilityGrant = {
      ...req.grant,
      capability: {
        ...req.grant.capability,
        id: (req.grant.capability.id ?? `cap-${req.grant.id}`) as HashId,
        constraints: Array.isArray(req.grant.capability.constraints) ? req.grant.capability.constraints : [],
      },
    };
    const result = requestGrant(mutableState.identity, normalizedGrant);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message, hint: result.error.hint } };
    }
    return { ok: true, value: { id: req.grant.id }, state: result.state };
  }

  if (pathname.startsWith("/identity/grants/") && pathname.endsWith("/approve") && method === "POST") {
    const parts = pathname.split("/");
    const grantId = parts[3];
    const req = body as { approverId?: string; timestamp?: string };
    if (!grantId || !req.approverId || !req.timestamp) {
      return { ok: false, error: { code: "identity.missing-params", message: "Missing grantId, approverId, or timestamp", hint: "Provide all required fields" } };
    }
    const serverNowIso = new Date().toISOString() as Timestamp;
    const result = approveGrant(mutableState.identity, grantId as HashId, req.approverId as ActorId, serverNowIso);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message, hint: result.error.hint } };
    }
    return { ok: true, value: { grantId, status: "approved" }, state: result.state };
  }

  if (pathname.startsWith("/identity/grants/") && pathname.endsWith("/vc") && method === "POST") {
    const parts = pathname.split("/");
    const grantId = parts[3];
    const req = body as { issuerId?: string; issuerName?: string; credentialId?: string; verificationMethod?: string };
    if (!grantId) {
      return { ok: false, error: { code: "identity.missing-grant-id", message: "Missing grant ID in URL", hint: "Use /identity/grants/:id/vc" } };
    }
    const result = exportGrantAsVC(
      mutableState.identity,
      grantId as HashId,
      {
        issuerId: req.issuerId ?? "urn:cognate:issuer:unknown",
        ...(req.issuerName ? { issuerName: req.issuerName } : {}),
        ...(req.credentialId ? { credentialId: req.credentialId } : {}),
        ...(req.verificationMethod ? { verificationMethod: req.verificationMethod } : {}),
      }
    );
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message, hint: result.error.hint } };
    }
    return { ok: true, value: result.value, state: mutableState.identity };
  }

  return { ok: false, error: { code: "identity.not-found", message: "Route not found", hint: "Check URL" } };
}
