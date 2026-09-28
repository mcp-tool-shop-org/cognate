import { describe, it, expect } from "vitest";
import {
  createRegistry,
  registerModel,
  registerVersion,
  transitionVersion,
  getVersionHistory,
  getCurrentDeployedVersion,
} from "../src/registry.js";
import { RegistryError } from "../src/types.js";
import type { Model, ModelVersion } from "@cognate/types";

describe("model registry", () => {
  const makeModel = (id: string): Model => ({
    id,
    name: `Model ${id}`,
    createdAt: "2026-01-01T00:00:00Z",
  });

  const makeVersion = (
    id: string,
    modelId: string,
    version: string,
    state: ModelVersion["state"] = "registered",
  ): ModelVersion => ({
    id,
    modelId,
    version,
    state,
    createdAt: "2026-01-01T00:00:00Z",
  });

  it("creates an empty registry", () => {
    const state = createRegistry();
    expect(state.models).toEqual({});
    expect(state.versions).toEqual({});
    expect(state.transitions).toEqual({});
  });

  it("registers a model", () => {
    let state = createRegistry();
    const model = makeModel("m1");
    state = registerModel(state, model);
    expect(state.models["m1"]).toEqual(model);
  });

  it("throws when registering a duplicate model", () => {
    let state = createRegistry();
    const model = makeModel("m1");
    state = registerModel(state, model);
    expect(() => registerModel(state, model)).toThrow(RegistryError);
  });

  it("registers a version for an existing model", () => {
    let state = createRegistry();
    state = registerModel(state, makeModel("m1"));
    const version = makeVersion("v1", "m1", "1.0.0");
    state = registerVersion(state, version);
    expect(state.versions["v1"]).toEqual(version);
  });

  it("throws when registering a version for a missing model", () => {
    const state = createRegistry();
    const version = makeVersion("v1", "m1", "1.0.0");
    expect(() => registerVersion(state, version)).toThrow(RegistryError);
  });

  it("throws when registering a duplicate version", () => {
    let state = createRegistry();
    state = registerModel(state, makeModel("m1"));
    const version = makeVersion("v1", "m1", "1.0.0");
    state = registerVersion(state, version);
    expect(() => registerVersion(state, version)).toThrow(RegistryError);
  });

  it("transitions a version through valid states", () => {
    let state = createRegistry();
    state = registerModel(state, makeModel("m1"));
    state = registerVersion(state, makeVersion("v1", "m1", "1.0.0"));
    state = transitionVersion(state, "v1", "registered", "evaluated", "actor-1", "Initial evaluation");
    expect(state.versions["v1"].state).toBe("evaluated");
    state = transitionVersion(state, "v1", "evaluated", "approved", "actor-1", "Policy approved");
    expect(state.versions["v1"].state).toBe("approved");
    state = transitionVersion(state, "v1", "approved", "deployed", "actor-1", "Deployed to prod");
    expect(state.versions["v1"].state).toBe("deployed");
  });

  it("records transition events with reason and timestamp", () => {
    let state = createRegistry();
    state = registerModel(state, makeModel("m1"));
    state = registerVersion(state, makeVersion("v1", "m1", "1.0.0"));
    state = transitionVersion(state, "v1", "registered", "evaluated", "actor-1", "Evaluated");
    const events = state.transitions["v1"];
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe("registered");
    expect(events[0].to).toBe("evaluated");
    expect(events[0].actorId).toBe("actor-1");
    expect(events[0].reason).toBe("Evaluated");
    expect(typeof events[0].timestamp).toBe("string");
  });

  it("throws on invalid transition", () => {
    let state = createRegistry();
    state = registerModel(state, makeModel("m1"));
    state = registerVersion(state, makeVersion("v1", "m1", "1.0.0"));
    expect(() =>
      transitionVersion(state, "v1", "registered", "deployed", "actor-1", "Skip"),
    ).toThrow(RegistryError);
  });

  it("throws when transitioning from wrong current state", () => {
    let state = createRegistry();
    state = registerModel(state, makeModel("m1"));
    state = registerVersion(state, makeVersion("v1", "m1", "1.0.0"));
    state = transitionVersion(state, "v1", "registered", "evaluated", "actor-1", "Evaluated");
    expect(() =>
      transitionVersion(state, "v1", "registered", "approved", "actor-1", "Wrong from"),
    ).toThrow(RegistryError);
  });

  it("returns ordered version history for a model", () => {
    let state = createRegistry();
    state = registerModel(state, makeModel("m1"));
    state = registerVersion(state, { ...makeVersion("v1", "m1", "1.0.0"), createdAt: "2026-01-01T00:00:00Z" });
    state = registerVersion(state, { ...makeVersion("v2", "m1", "2.0.0"), createdAt: "2026-01-02T00:00:00Z" });
    const history = getVersionHistory(state, "m1");
    expect(history.map((v) => v.version)).toEqual(["1.0.0", "2.0.0"]);
  });

  it("returns the current deployed version", () => {
    let state = createRegistry();
    state = registerModel(state, makeModel("m1"));
    state = registerVersion(state, makeVersion("v1", "m1", "1.0.0"));
    state = registerVersion(state, makeVersion("v2", "m1", "2.0.0"));
    state = transitionVersion(state, "v1", "registered", "evaluated", "actor-1", "Eval");
    state = transitionVersion(state, "v1", "evaluated", "approved", "actor-1", "App");
    state = transitionVersion(state, "v1", "approved", "deployed", "actor-1", "Dep");
    const current = getCurrentDeployedVersion(state, "m1");
    expect(current?.id).toBe("v1");
  });

  it("returns undefined when no deployed version exists", () => {
    const state = createRegistry();
    expect(getCurrentDeployedVersion(state, "m1")).toBeUndefined();
  });

  it("allows rejection from evaluated", () => {
    let state = createRegistry();
    state = registerModel(state, makeModel("m1"));
    state = registerVersion(state, makeVersion("v1", "m1", "1.0.0"));
    state = transitionVersion(state, "v1", "registered", "evaluated", "actor-1", "Evaluated");
    state = transitionVersion(state, "v1", "evaluated", "rejected", "actor-1", "Failed policy");
    expect(state.versions["v1"].state).toBe("rejected");
  });

  it("allows retirement from deployed", () => {
    let state = createRegistry();
    state = registerModel(state, makeModel("m1"));
    state = registerVersion(state, makeVersion("v1", "m1", "1.0.0"));
    state = transitionVersion(state, "v1", "registered", "evaluated", "actor-1", "Evaluated");
    state = transitionVersion(state, "v1", "evaluated", "approved", "actor-1", "Approved");
    state = transitionVersion(state, "v1", "approved", "deployed", "actor-1", "Deployed");
    state = transitionVersion(state, "v1", "deployed", "retired", "actor-1", "Retired");
    expect(state.versions["v1"].state).toBe("retired");
  });
});
