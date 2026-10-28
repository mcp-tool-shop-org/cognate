import { describe, expect, it } from "vitest";
import * as root from "../src/index.js";
import * as policy from "../src/policy.js";
import * as modelRegistry from "../src/model-registry.js";
import * as agentIdentity from "../src/agent-identity.js";
import * as promptStore from "../src/prompt-store.js";
import * as civilityKernel from "../src/civility-kernel.js";

describe("@mcptoolshop/cognate bundle", () => {
  it("exports each domain as a namespace", () => {
    expect(typeof root.policy.evaluatePolicy).toBe("function");
    expect(typeof root.modelRegistry.createRegistry).toBe("function");
    expect(typeof root.agentIdentity.registerAgent).toBe("function");
    expect(typeof root.promptStore.createStore).toBe("function");
    expect(typeof root.civilityKernel.createKernel).toBe("function");
  });

  it("re-exports the load-bearing calls on each subpath", () => {
    expect(typeof policy.evaluatePolicy).toBe("function");
    expect(typeof modelRegistry.registerModel).toBe("function");
    expect(typeof modelRegistry.attestRunPreRegistered).toBe("function");
    expect(typeof modelRegistry.attestRunCompleted).toBe("function");
    expect(typeof modelRegistry.validateHashedIdentifiers).toBe("function");
    expect(typeof agentIdentity.requestGrant).toBe("function");
    expect(typeof promptStore.encrypt).toBe("function");
    expect(typeof civilityKernel.createKernel).toBe("function");
    expect(typeof civilityKernel.attestDecision).toBe("function");
    expect(typeof civilityKernel.computeDecisionDigests).toBe("function");
  });
});
