import { describe, expect, it } from "vitest";
import { createRegistry, registerModel, registerVersion } from "../src/registry.js";
import { attestTransitionVersion, buildTransitionProof } from "../src/attestation.js";
import { RegistryError } from "../src/types.js";
import type { Model, ModelVersion } from "@cognate/types";

const model: Model = {
  id: "m1",
  name: "Model m1",
  createdAt: "2026-01-01T00:00:00Z",
};

const version: ModelVersion = {
  id: "v1",
  modelId: "m1",
  version: "1.0.0",
  status: "registered",
  createdAt: "2026-01-01T00:00:00Z",
};

function registered() {
  let state = createRegistry();
  state = registerModel(state, model);
  state = registerVersion(state, version);
  return state;
}

describe("attestia transition log", () => {
  it("applies the transition and appends one event", async () => {
    const appended: unknown[] = [];
    const next = await attestTransitionVersion(
      registered(),
      {
        tenantId: "tenant-1",
        eventStore: {
          async append(streamId, event) {
            appended.push(streamId, event);
          },
        },
      },
      "v1",
      "registered",
      "evaluated",
      "actor-1",
      "Evaluated",
    );
    expect(next.versions["v1"].status).toBe("evaluated");
    expect(appended[0]).toBe("cognate-tenant-1-transitions");
    const events = appended[1] as Array<{ type: string; metadata: { source: string; correlationId: string } }>;
    expect(events[0].type).toBe("cognate.model.transitioned");
    expect(events[0].metadata.source).toBe("external");
    expect(events[0].metadata.correlationId).toBe("v1");
    const proof = buildTransitionProof(next, "v1");
    expect(proof?.count).toBe(1);
    expect(proof?.root).toMatch(/^[0-9a-f]{64}$/);
  });

  it("uses a custom stream prefix", async () => {
    const ids: string[] = [];
    await attestTransitionVersion(
      registered(),
      {
        tenantId: "tenant-1",
        streamPrefix: "lab",
        eventStore: {
          async append(streamId) {
            ids.push(streamId);
          },
        },
      },
      "v1",
      "registered",
      "evaluated",
      "actor-1",
      "Evaluated",
    );
    expect(ids).toEqual(["lab-tenant-1-transitions"]);
  });

  it("throws when the event store rejects the append", async () => {
    const input = registered();
    await expect(
      attestTransitionVersion(
        input,
        {
          tenantId: "tenant-1",
          eventStore: {
            async append() {
              throw new Error("store down");
            },
          },
        },
        "v1",
        "registered",
        "evaluated",
        "actor-1",
        "Evaluated",
      ),
    ).rejects.toBeInstanceOf(RegistryError);
    expect(input.versions["v1"].status).toBe("registered");
  });

  it("returns null when a version has no transitions", () => {
    expect(buildTransitionProof(registered(), "v1")).toBeNull();
    expect(buildTransitionProof(registered(), "missing")).toBeNull();
  });
});
