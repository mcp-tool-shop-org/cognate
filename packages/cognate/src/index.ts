/**
 * @mcptoolshop/cognate — the Cognate libraries, one package.
 *
 * The root entry exposes every domain as a namespace:
 *
 *   import { policy, modelRegistry } from "@mcptoolshop/cognate";
 *
 * Flat imports use the subpaths:
 *
 *   import { evaluatePolicy } from "@mcptoolshop/cognate/policy";
 */
export * as types from "@cognate/types";
export * as policy from "@cognate/policy";
export * as modelRegistry from "@cognate/model-registry";
export * as agentIdentity from "@cognate/agent-identity";
export * as promptStore from "@cognate/prompt-store";
export * as repomeshBridge from "@cognate/repomesh-bridge";
