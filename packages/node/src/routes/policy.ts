import { randomUUID } from "node:crypto";
import type { ServerResponse } from "http";
import { evaluatePolicy } from "@cognate/policy";
import type { Policy } from "@cognate/types";
import type { EvaluationContext } from "@cognate/policy";
import type { DomainEvent, EventStore } from "@mcptoolshop/attestia/event-store";

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

/**
 * Evaluate a policy and append the decision. A denial is an event.
 * Prompt text is evaluated and then dropped. It is not in the event.
 * A failed append does not return the decision.
 */
export async function handlePolicy(
  res: ServerResponse,
  body: unknown,
  eventStore: Pick<EventStore, "append">,
): Promise<void> {
  const req = body as { policy?: Policy; context?: EvaluationContext };
  if (!req.policy || !req.context) {
    send(res, 400, { error: "Missing policy or context" });
    return;
  }

  const result = evaluatePolicy(req.policy, req.context);
  const eventId = randomUUID();
  const event: DomainEvent = {
    type: "cognate.policy.evaluated",
    metadata: {
      eventId,
      timestamp: req.context.timestamp,
      actor: req.context.actorId,
      correlationId: req.policy.id,
      source: "external",
    },
    payload: {
      policyId: result.policyId,
      policyVersion: result.policyVersion,
      overall: result.overall,
      tenantId: req.context.tenantId,
      actorId: req.context.actorId,
      evaluatedAt: result.evaluatedAt,
      matchedRuleIds: result.matchedRules.map((rule) => rule.ruleId),
      blockingRuleIds: result.blockingRules.map((rule) => rule.ruleId),
    },
  };

  try {
    await eventStore.append(`cognate-${req.context.tenantId}-policy`, [event]);
  } catch (err) {
    send(res, 503, {
      error: "attestia.append-failed",
      message: `Attestia append failed: ${err instanceof Error ? err.message : String(err)}`,
      hint: "The decision was not returned. The event store rejected the append.",
    });
    return;
  }

  send(res, 200, { ...result, eventId });
}
