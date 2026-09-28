/**
 * Agent Authentication Middleware
 *
 * Authenticates requests via X-Agent-Id + X-Timestamp headers.
 * Uses @cognate/agent-identity to verify the agent exists and
 * has a required capability.
 */

import type { IncomingMessage } from "http";
import type { ActorId, Timestamp, CapabilityKind } from "@cognate/types";
import type { IdentityRegistryState } from "@cognate/agent-identity";
import { getAgent, hasCapability } from "@cognate/agent-identity";

export interface AuthConfig {
  readonly identityState: IdentityRegistryState;
  readonly requiredCapability?: CapabilityKind;
}

export interface AuthenticatedRequest {
  readonly agentId: ActorId;
  readonly timestamp: Timestamp;
}

export function extractCredentials(req: IncomingMessage): { agentId: ActorId; timestamp: Timestamp } | null {
  const agentId = req.headers["x-agent-id"] as string | undefined;
  const timestamp = req.headers["x-timestamp"] as string | undefined;
  if (!agentId || !timestamp) return null;
  if (typeof agentId !== "string" || typeof timestamp !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp)) return null;
  return { agentId: agentId as ActorId, timestamp: timestamp as Timestamp };
}

export function authenticate(
  req: IncomingMessage,
  config: AuthConfig
): { ok: true; agent: AuthenticatedRequest } | { ok: false; code: string; message: string } {
  const creds = extractCredentials(req);
  if (!creds) {
    return { ok: false, code: "auth.missing-credentials", message: "Missing X-Agent-Id or X-Timestamp header" };
  }
  const agent = getAgent(config.identityState, creds.agentId);
  if (!agent) {
    return { ok: false, code: "auth.agent-not-found", message: `Agent ${creds.agentId} not registered` };
  }
  if (agent.status !== "active") {
    return { ok: false, code: "auth.agent-inactive", message: `Agent ${creds.agentId} is ${agent.status}` };
  }
  if (config.requiredCapability) {
    const hasCap = hasCapability(config.identityState, creds.agentId, config.requiredCapability, creds.timestamp);
    if (!hasCap) {
      return {
        ok: false,
        code: "auth.missing-capability",
        message: `Agent ${creds.agentId} lacks ${config.requiredCapability} capability`,
      };
    }
  }
  return { ok: true, agent: creds };
}
