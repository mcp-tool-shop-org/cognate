import {
  createRegistry as createIdentityRegistry,
  registerAgent,
  approveGrant,
} from "@cognate/agent-identity";
import type { Agent } from "@cognate/types";
import type { ServerState } from "../server.js";

interface RouteResult<T> {
  ok: boolean;
  value?: T;
  error?: { code: string; message: string; hint: string };
  state?: ReturnType<typeof createIdentityRegistry>;
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
    const result = registerAgent(mutableState.identity, req.agent);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message, hint: result.error.hint } };
    }
    return { ok: true, value: { id: req.agent.id }, state: result.state };
  }

  if (pathname.startsWith("/identity/grants/") && pathname.endsWith("/approve") && method === "POST") {
    const parts = pathname.split("/");
    const grantId = parts[3];
    const req = body as { approverId?: string; timestamp?: string };
    if (!grantId || !req.approverId || !req.timestamp) {
      return { ok: false, error: { code: "identity.missing-params", message: "Missing grantId, approverId, or timestamp", hint: "Provide all required fields" } };
    }
    const result = approveGrant(mutableState.identity, grantId as import("@cognate/types").HashId, req.approverId as import("@cognate/types").ActorId, req.timestamp as import("@cognate/types").Timestamp);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message, hint: result.error.hint } };
    }
    return { ok: true, value: { grantId, status: "approved" }, state: result.state };
  }

  return { ok: false, error: { code: "identity.not-found", message: "Route not found", hint: "Check URL" } };
}
