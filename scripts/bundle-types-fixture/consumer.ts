// Imports a type and a value from the root entry and from every subpath of @mcptoolshop/cognate, as a consumer
// who installed it from npm would. scripts/check-bundle-types.mjs compiles this with tsc --noEmit.
import { civilityKernel, policy, modelRegistry } from "@mcptoolshop/cognate";
import type { TenantId } from "@mcptoolshop/cognate/types";
import { evaluatePolicy, type PolicyResult } from "@mcptoolshop/cognate/policy";
import { createRegistry, type RegistryState } from "@mcptoolshop/cognate/model-registry";
import { registerAgent } from "@mcptoolshop/cognate/agent-identity";
import { createStore, type PromptStoreState } from "@mcptoolshop/cognate/prompt-store";
import { verifyRelease, type RepomeshResult } from "@mcptoolshop/cognate/repomesh-bridge";
import { computeDecisionDigests, createKernel, type DecisionTrace } from "@mcptoolshop/cognate/civility-kernel";

const tenant = "tenant-1" as TenantId;
const registry: RegistryState = createRegistry();
const store: PromptStoreState = createStore();
let result: PolicyResult | undefined;
let release: RepomeshResult | undefined;

const kernel = createKernel({
  policy: {
    version: "1.0",
    weights: { efficiency: 1 },
    constraints: [],
    contextRules: [],
    uncertaintyThreshold: 1,
    memory: {},
    calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
  },
});
const trace: DecisionTrace = kernel.decide("ops", []);
const digests: { decisionSha256: string } = computeDecisionDigests(trace);

// The root namespaces carry the same functions, with their types.
const sameKernel: typeof createKernel = civilityKernel.createKernel;
const sameEvaluate: typeof evaluatePolicy = policy.evaluatePolicy;
const sameRegistry: typeof createRegistry = modelRegistry.createRegistry;

export { tenant, registry, store, result, release, digests, sameKernel, sameEvaluate, sameRegistry, registerAgent, verifyRelease };
