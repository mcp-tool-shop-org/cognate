/**
 * Snapshots of the three Cognate states. These files are the records a restart
 * shows. They are not the event log. The log is Attestia's.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createRegistry as createModelRegistry } from "@cognate/model-registry";
import type { RegistryState } from "@cognate/model-registry";
import { createRegistry as createIdentityRegistry } from "@cognate/agent-identity";
import type { IdentityRegistryState } from "@cognate/agent-identity";
import { createStore, logOutput, logPrompt } from "@cognate/prompt-store";
import type { PromptStoreState } from "@cognate/prompt-store";
import type { Agent, CapabilityGrant, Output, Prompt } from "@cognate/types";

export interface SnapshotState {
  registry: RegistryState;
  identity: IdentityRegistryState;
  prompts: PromptStoreState;
}

export interface SnapshotPaths {
  readonly registry: string;
  readonly agents: string;
  readonly prompts: string;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(value), "utf8");
  renameSync(tmp, path);
}

function readJson(path: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return undefined;
    throw err;
  }
}

export function saveSnapshots(paths: SnapshotPaths, state: SnapshotState): void {
  writeJson(paths.registry, state.registry);
  writeJson(paths.agents, {
    agents: [...state.identity.agents.values()],
    grants: [...state.identity.grants.values()],
  });
  writeJson(paths.prompts, {
    prompts: [...state.prompts.prompts.values()],
    outputs: [...state.prompts.outputs.values()],
  });
}

export function loadSnapshots(paths: SnapshotPaths): SnapshotState {
  return {
    registry: loadRegistry(paths.registry),
    identity: loadIdentity(paths.agents),
    prompts: loadPrompts(paths.prompts),
  };
}

function loadRegistry(path: string): RegistryState {
  const raw = readJson(path);
  if (raw === undefined) return createModelRegistry();
  const saved = raw as RegistryState;
  return {
    models: saved.models ?? {},
    versions: saved.versions ?? {},
    transitions: saved.transitions ?? {},
  };
}

function loadIdentity(path: string): IdentityRegistryState {
  const raw = readJson(path);
  if (raw === undefined) return createIdentityRegistry();
  const saved = raw as { agents?: Agent[]; grants?: CapabilityGrant[] };
  return {
    agents: new Map((saved.agents ?? []).map((agent) => [agent.id, agent])),
    grants: new Map((saved.grants ?? []).map((grant) => [grant.id, grant])),
  };
}

function loadPrompts(path: string): PromptStoreState {
  const raw = readJson(path);
  if (raw === undefined) return createStore();
  const saved = raw as { prompts?: Prompt[]; outputs?: Output[] };
  let state = createStore();
  for (const prompt of saved.prompts ?? []) {
    const result = logPrompt(state, prompt);
    if (!result.ok) {
      throw new Error(`Prompt snapshot rejected ${prompt.id}: ${result.error.message}`);
    }
    state = result.state;
  }
  for (const output of saved.outputs ?? []) {
    const result = logOutput(state, output);
    if (!result.ok) {
      throw new Error(`Output snapshot rejected ${output.id}: ${result.error.message}`);
    }
    state = result.state;
  }
  return state;
}
