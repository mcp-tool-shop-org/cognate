import { describe, expect, it } from 'vitest';
import {
  createStore,
  logPrompt,
  logOutput,
  getPrompt,
  getOutput,
  getOutputsForPrompt,
  getSessionPrompts,
  getModelVersionPrompts,
  getPromptsByAgent,
  getPromptsInRange,
} from '../src/store.js';

const now = '2026-09-28T12:00:00.000Z';

const basePrompt = {
  id: 'prompt-1',
  tenantId: 'tenant-1',
  sessionId: 'session-1',
  modelVersionId: 'model-v1',
  policyVersion: 1,
  agentId: 'agent-1',
  plaintextHash: 'abcd1234',
  ciphertext: '{"c":"test","i":"test","a":"test"}',
  metadata: {
    tokensIn: 10,
    tokensOut: null,
    systemPromptHash: null,
    temperature: 0.7,
    topP: null,
    tags: ['test'],
  },
  submittedAt: now,
};

const baseOutput = {
  id: 'output-1',
  tenantId: 'tenant-1',
  promptId: 'prompt-1',
  modelVersionId: 'model-v1',
  plaintextHash: 'efgh5678',
  ciphertext: '{"c":"test","i":"test","a":"test"}',
  metadata: {
    tokensOut: 20,
    latencyMs: 500,
    finishReason: 'stop',
    confidence: 0.95,
  },
  generatedAt: now,
};

describe('prompt-store', () => {
  it('creates an empty store', () => {
    const state = createStore();
    expect(state.prompts.size).toBe(0);
    expect(state.outputs.size).toBe(0);
  });

  it('logs a prompt', () => {
    let state = createStore();
    const result = logPrompt(state, basePrompt);
    expect(result.ok).toBe(true);
    expect(result.state.prompts.size).toBe(1);
    expect(getPrompt(result.state, 'prompt-1')).toEqual(basePrompt);
  });

  it('fails to log duplicate prompt', () => {
    let state = createStore();
    state = logPrompt(state, basePrompt).state;
    const result = logPrompt(state, basePrompt);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('store.duplicate-prompt');
  });

  it('logs an output', () => {
    let state = createStore();
    state = logPrompt(state, basePrompt).state;
    const result = logOutput(state, baseOutput);
    expect(result.ok).toBe(true);
    expect(result.state.outputs.size).toBe(1);
  });

  it('fails to log output without prompt', () => {
    const state = createStore();
    const result = logOutput(state, baseOutput);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('store.prompt-not-found');
  });

  it('fails to log duplicate output', () => {
    let state = createStore();
    state = logPrompt(state, basePrompt).state;
    state = logOutput(state, baseOutput).state;
    const result = logOutput(state, baseOutput);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('store.duplicate-output');
  });

  it('gets outputs for a prompt', () => {
    let state = createStore();
    state = logPrompt(state, basePrompt).state;
    state = logOutput(state, baseOutput).state;
    const outputs = getOutputsForPrompt(state, 'prompt-1');
    expect(outputs).toHaveLength(1);
    expect(outputs[0].id).toBe('output-1');
  });

  it('gets session prompts', () => {
    let state = createStore();
    state = logPrompt(state, basePrompt).state;
    const prompts = getSessionPrompts(state, 'session-1');
    expect(prompts).toHaveLength(1);
  });

  it('gets model version prompts', () => {
    let state = createStore();
    state = logPrompt(state, basePrompt).state;
    const prompts = getModelVersionPrompts(state, 'model-v1');
    expect(prompts).toHaveLength(1);
  });

  it('gets prompts by agent', () => {
    let state = createStore();
    state = logPrompt(state, basePrompt).state;
    state = logPrompt(state, { ...basePrompt, id: 'prompt-2', agentId: null }).state;
    const agentPrompts = getPromptsByAgent(state, 'agent-1');
    expect(agentPrompts).toHaveLength(1);
    expect(agentPrompts[0].id).toBe('prompt-1');
  });

  it('gets prompts in time range', () => {
    let state = createStore();
    state = logPrompt(state, basePrompt).state;
    state = logPrompt(state, { ...basePrompt, id: 'prompt-2', submittedAt: '2026-09-27T10:00:00.000Z' }).state;
    const inRange = getPromptsInRange(state, '2026-09-28T00:00:00.000Z', '2026-09-28T23:59:59.000Z');
    expect(inRange).toHaveLength(1);
    expect(inRange[0].id).toBe('prompt-1');
  });
});
