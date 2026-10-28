import { describe, expect, it } from "vitest";
import { InMemoryEventStore } from "@mcptoolshop/attestia/event-store";
import { attestDecision, createKernel } from "@cognate/civility-kernel";
import { eventVisibleToTenant, proveRecordedEvent } from "../src/event-proof.js";

describe("civility-kernel decisions are provable", () => {
  it("serves an inclusion proof for cognate.policy.decided on the policy stream", async () => {
    const store = new InMemoryEventStore();
    const kernel = createKernel({
      policy: {
        version: "1.0",
        weights: { efficiency: 1 },
        constraints: ["no_irreversible_changes"],
        contextRules: [],
        uncertaintyThreshold: 1,
        memory: {},
        calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
      },
    });
    const plan = { id: "p1", summary: "Reversible", steps: [{ kind: "edit", detail: "write a file" }], meta: { reversibility: 1 as const } };
    const trace = kernel.decide("ops", [plan], { decisionId: "dec-1", timestamp: "2026-10-28T00:00:00.000Z" });

    const { eventId, streamId } = await attestDecision({ eventStore: store, tenantId: "tenant-1", actorId: "agent-7" }, trace, plan);

    expect(eventVisibleToTenant(streamId, "tenant-1")).toBe(true);
    const proved = proveRecordedEvent(store.readAll(), eventId, "tenant-1");
    expect(proved.ok).toBe(true);
    expect(proveRecordedEvent(store.readAll(), eventId, "tenant-2").ok).toBe(false);
  });
});
