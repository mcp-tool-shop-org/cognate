/**
 * Attestia integration for civility-kernel decisions.
 *
 * `decide` stays pure; this module hashes its trace and records it on the tenant's policy stream, the way
 * `@cognate/model-registry` wraps its registry. The digests are the values `RunPreRegistration.planSha256` and
 * `decisionSha256` expect: 64 lowercase hex characters, SHA-256 over RFC 8785 canonical JSON.
 */

import { createHash, randomUUID } from "node:crypto";
import { canonicalize } from "json-canonicalize";
import type { HashId } from "@cognate/types";
import type { DomainEvent, EventStore } from "@mcptoolshop/attestia/event-store";
import type { DecisionTrace, Plan } from "./policy/types.js";

export class AttestationError extends Error {
  /** Stable machine-readable error code. */
  readonly code: string;

  /** Actionable hint for resolving the error. */
  readonly hint: string;

  constructor(args: { code: string; message: string; hint: string }) {
    super(args.message);
    this.name = "AttestationError";
    this.code = args.code;
    this.hint = args.hint;
  }
}

export interface DecisionDigests {
  /** SHA-256 of the whole trace: the decision line a run can be pre-registered against. */
  readonly decisionSha256: HashId;
  /** SHA-256 of the effective policy the decision used (after context rules). */
  readonly policySha256: HashId;
  /** SHA-256 of the chosen plan, steps included; `null` when no plan was chosen or none was passed. */
  readonly planSha256: HashId | null;
}

/** Find a number JSON can't hold. `json-canonicalize` writes NaN and ±Infinity as `null` without complaint. */
function nonFinitePath(value: unknown, path: string): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? null : path;
  if (value === null || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    const found = nonFinitePath(child, `${path}.${key}`);
    if (found !== null) return found;
  }
  return null;
}

function sha256Canonical(value: unknown, what: string): HashId {
  const bad = nonFinitePath(value, what);
  if (bad !== null) {
    throw new AttestationError({
      code: "civility.non-finite-number",
      message: `${bad} is not a finite number, so ${what} has no canonical JSON form.`,
      hint: "Use null for a missing number; failed plans carry utility null.",
    });
  }
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex") as HashId;
}

/**
 * Compute the digests of a decision. Pass `chosenPlan` (the full plan, with its steps) to get `planSha256`; it must
 * be the plan the trace chose.
 */
export function computeDecisionDigests(trace: DecisionTrace, chosenPlan?: Plan): DecisionDigests {
  if (chosenPlan !== undefined && chosenPlan.id !== trace.chosenPlanId) {
    throw new AttestationError({
      code: "civility.plan-mismatch",
      message:
        trace.chosenPlanId === undefined
          ? `Plan "${chosenPlan.id}" was passed, but the decision chose no plan (outcome ${trace.outcome}).`
          : `Plan "${chosenPlan.id}" was passed, but the decision chose "${trace.chosenPlanId}".`,
      hint: "Pass the plan returned as `chosen` by decide, or no plan.",
    });
  }
  return {
    decisionSha256: sha256Canonical(trace, "trace"),
    policySha256: sha256Canonical(trace.effectivePolicy, "trace.effectivePolicy"),
    planSha256: chosenPlan === undefined ? null : sha256Canonical(chosenPlan, "chosenPlan"),
  };
}

export interface AttestDecisionConfig {
  readonly eventStore: Pick<EventStore, "append">;
  readonly tenantId: string;
  /** Who made the decision: recorded as the event's actor. */
  readonly actorId: string;
  readonly streamPrefix?: string;
}

export interface AttestedDecision {
  readonly eventId: string;
  readonly streamId: string;
  readonly trace: DecisionTrace;
  readonly digests: DecisionDigests;
}

/**
 * Append `cognate.policy.decided` to the tenant's policy stream and return the digests.
 *
 * The payload carries the digests and the decision's outline (outcome, chosen plan id, which context rules fired,
 * which constraint each failed plan broke), never plan steps or constraint reasons. Nothing is returned unless the
 * append succeeds.
 */
export async function attestDecision(
  config: AttestDecisionConfig,
  trace: DecisionTrace,
  chosenPlan?: Plan,
): Promise<AttestedDecision> {
  const digests = computeDecisionDigests(trace, chosenPlan);
  const streamId = `${config.streamPrefix ?? "cognate"}-${config.tenantId}-policy`;
  const eventId = randomUUID();
  const event: DomainEvent = {
    type: "cognate.policy.decided",
    metadata: {
      eventId,
      timestamp: trace.timestamp,
      actor: config.actorId,
      correlationId: trace.decisionId,
      source: "external",
    },
    payload: {
      decisionId: trace.decisionId,
      tenantId: config.tenantId,
      context: trace.context,
      outcome: trace.outcome,
      chosenPlanId: trace.chosenPlanId ?? null,
      decisionSha256: digests.decisionSha256,
      policySha256: digests.policySha256,
      planSha256: digests.planSha256,
      appliedContextRules: trace.appliedContextRules.map((r) => r.context),
      violatedConstraints: trace.candidates
        .filter((c) => !c.eval.passesConstraints)
        .map((c) => ({
          planId: c.eval.planId,
          constraintIds: c.eval.violatedConstraints.map((v) => (typeof v === "string" ? v : v.id)),
        })),
    },
  };
  try {
    await config.eventStore.append(streamId, [event]);
  } catch (err) {
    throw new AttestationError({
      code: "attestia.append-failed",
      message: `Attestia append failed: ${err instanceof Error ? err.message : String(err)}`,
      hint: "The decision was not attested. Retry the append, or don't act on the decision.",
    });
  }
  return { eventId, streamId, trace, digests };
}
