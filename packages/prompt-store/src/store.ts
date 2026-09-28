/**
 * Prompt/Output Store — pure functions for logging and retrieval.
 *
 * The store maintains an append-only log of Prompt and Output records.
 * Encryption is handled externally; the store receives ciphertext + hash.
 */

import type { ActorId, HashId, Output, Prompt, TenantId, Timestamp } from "@cognate/types";

export interface PromptStoreState {
  readonly prompts: ReadonlyMap<HashId, Prompt>;
  readonly outputs: ReadonlyMap<HashId, Output>;
  readonly sessionPrompts: ReadonlyMap<string, readonly HashId[]>;
  readonly modelVersionPrompts: ReadonlyMap<HashId, readonly HashId[]>;
}

export interface StoreError {
  readonly code: string;
  readonly message: string;
  readonly hint: string;
}

export type StoreResult<T> =
  | { readonly ok: true; readonly value: T; readonly state: PromptStoreState }
  | { readonly ok: false; readonly error: StoreError; readonly state: PromptStoreState };

function err(code: string, message: string, hint: string): StoreError {
  return { code, message, hint };
}

function ok<T>(value: T, state: PromptStoreState): StoreResult<T> {
  return { ok: true, value, state };
}

function fail<T>(error: StoreError, state: PromptStoreState): StoreResult<T> {
  return { ok: false, error, state };
}

/** Create an empty prompt store. */
export function createStore(): PromptStoreState {
  return {
    prompts: new Map(),
    outputs: new Map(),
    sessionPrompts: new Map(),
    modelVersionPrompts: new Map(),
  };
}

/** Log a prompt. Fails if prompt ID already exists. */
export function logPrompt(
  state: PromptStoreState,
  prompt: Prompt
): StoreResult<void> {
  if (state.prompts.has(prompt.id)) {
    return fail(err("store.duplicate-prompt", `Prompt ${prompt.id} already logged`, "Each prompt must have a unique ID."), state);
  }
  const newPrompts = new Map(state.prompts);
  newPrompts.set(prompt.id, prompt);

  // Index by session
  const newSessionPrompts = new Map(state.sessionPrompts);
  const sessionList = newSessionPrompts.get(prompt.sessionId) ?? [];
  newSessionPrompts.set(prompt.sessionId, [...sessionList, prompt.id]);

  // Index by model version
  const newModelPrompts = new Map(state.modelVersionPrompts);
  const modelList = newModelPrompts.get(prompt.modelVersionId) ?? [];
  newModelPrompts.set(prompt.modelVersionId, [...modelList, prompt.id]);

  return ok(undefined, {
    prompts: newPrompts,
    outputs: state.outputs,
    sessionPrompts: newSessionPrompts,
    modelVersionPrompts: newModelPrompts,
  });
}

/** Log an output. Fails if output ID exists or prompt not found. */
export function logOutput(
  state: PromptStoreState,
  output: Output
): StoreResult<void> {
  if (state.outputs.has(output.id)) {
    return fail(err("store.duplicate-output", `Output ${output.id} already logged`, "Each output must have a unique ID."), state);
  }
  if (!state.prompts.has(output.promptId)) {
    return fail(err("store.prompt-not-found", `Prompt ${output.promptId} not found`, "Log the prompt before logging its output."), state);
  }
  const newOutputs = new Map(state.outputs);
  newOutputs.set(output.id, output);
  return ok(undefined, { ...state, outputs: newOutputs });
}

/** Get a prompt by ID. */
export function getPrompt(state: PromptStoreState, id: HashId): Prompt | undefined {
  return state.prompts.get(id);
}

/** Get an output by ID. */
export function getOutput(state: PromptStoreState, id: HashId): Output | undefined {
  return state.outputs.get(id);
}

/** Get outputs for a given prompt. */
export function getOutputsForPrompt(state: PromptStoreState, promptId: HashId): readonly Output[] {
  return Array.from(state.outputs.values()).filter((o) => o.promptId === promptId);
}

/** Get all prompts in a session. */
export function getSessionPrompts(state: PromptStoreState, sessionId: string): readonly Prompt[] {
  const ids = state.sessionPrompts.get(sessionId) ?? [];
  return ids.map((id) => state.prompts.get(id)).filter((p): p is Prompt => p !== undefined);
}

/** Get all prompts for a model version. */
export function getModelVersionPrompts(state: PromptStoreState, modelVersionId: HashId): readonly Prompt[] {
  const ids = state.modelVersionPrompts.get(modelVersionId) ?? [];
  return ids.map((id) => state.prompts.get(id)).filter((p): p is Prompt => p !== undefined);
}

/** Get all prompts by an agent. */
export function getPromptsByAgent(state: PromptStoreState, agentId: ActorId): readonly Prompt[] {
  return Array.from(state.prompts.values()).filter((p) => p.agentId === agentId);
}

/** Get all prompts in a time range (inclusive). */
export function getPromptsInRange(
  state: PromptStoreState,
  start: Timestamp,
  end: Timestamp
): readonly Prompt[] {
  return Array.from(state.prompts.values()).filter(
    (p) => p.submittedAt >= start && p.submittedAt <= end
  );
}
