/**
 * Tenant scoping. Every route acts in the authenticated agent's tenant and refuses anything else.
 *
 * A record that names another tenant is refused as a mismatch. An id that belongs to another tenant is answered exactly
 * as a missing id is, so a caller can't learn that another tenant's version, model, prompt, agent or grant exists.
 *
 * This is necessary, not sufficient: the agent itself is still self-asserted (an unsigned X-Agent-Id header).
 */

import type { ActorId, HashId } from "@cognate/types";
import type { ServerState } from "./server.js";

export interface Refusal {
  readonly status: number;
  readonly body: { readonly code: string; readonly message: string; readonly hint: string };
}

type Owned = { readonly tenantId?: unknown } | undefined;

function mismatch(prefix: string, what: string): Refusal {
  return {
    status: 400,
    body: {
      code: `${prefix}.tenant-mismatch`,
      message: `The ${what}'s tenantId must be your own tenant.`,
      hint: "Each request acts only in the authenticated agent's tenant.",
    },
  };
}

/** Refuses a record whose tenant isn't the caller's. */
export function refuseForeignRecord(prefix: string, what: string, record: Owned, tenantId: string): Refusal | null {
  return record !== undefined && record.tenantId !== tenantId ? mismatch(prefix, what) : null;
}

const hidden = (owned: Owned, tenantId: string): boolean => owned === undefined || owned.tenantId !== tenantId;

export function versionNotFound(versionId: string): Refusal {
  return {
    status: 404,
    body: {
      code: "VERSION_NOT_FOUND",
      message: `Model version with id "${versionId}" does not exist.`,
      hint: "Verify the version id or register it first.",
    },
  };
}

/** A version that is missing, or another tenant's, is answered as missing. */
export function refuseHiddenVersion(state: ServerState, versionId: string, tenantId: string): Refusal | null {
  return hidden(state.registry.versions[versionId], tenantId) ? versionNotFound(versionId) : null;
}

export function refuseHiddenModel(state: ServerState, modelId: string, tenantId: string): Refusal | null {
  if (!hidden(state.registry.models[modelId], tenantId)) return null;
  return {
    status: 404,
    body: {
      code: "MODEL_NOT_FOUND",
      message: `Model with id "${modelId}" does not exist.`,
      hint: "Register the model before adding versions to it.",
    },
  };
}

export function refuseHiddenPrompt(state: ServerState, promptId: string, tenantId: string): Refusal | null {
  if (!hidden(state.prompts.prompts.get(promptId as HashId), tenantId)) return null;
  return {
    status: 404,
    body: { code: "store.prompt-not-found", message: `Prompt ${promptId} not found`, hint: "Log the prompt before logging its output." },
  };
}

export function refuseHiddenAgent(state: ServerState, agentId: string, tenantId: string): Refusal | null {
  if (!hidden(state.identity.agents.get(agentId as ActorId), tenantId)) return null;
  return {
    status: 404,
    body: { code: "identity.agent-not-found", message: `Agent ${agentId} not found`, hint: "Register the agent before requesting a grant." },
  };
}

/** The approve and VC routes each keep their own not-found body; another tenant's grant gets that body. */
export function refuseHiddenGrant(
  state: ServerState,
  grantId: string,
  tenantId: string,
  route: "approve" | "vc",
): Refusal | null {
  if (!hidden(state.identity.grants.get(grantId as HashId), tenantId)) return null;
  return {
    status: 404,
    body:
      route === "approve"
        ? { code: "identity.grant-not-found", message: `Grant ${grantId} not found`, hint: "Check the grant ID and try again." }
        : { code: "vc.grant-not-found", message: `Grant ${grantId} not found`, hint: "Check the grant ID." },
  };
}

export function idMismatch(code: string, message: string): Refusal {
  return { status: 400, body: { code, message, hint: "The id in the path and the id in the body must be the same." } };
}
