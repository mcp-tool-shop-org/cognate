/**
 * @cognate/prompt-store — Encrypted Prompt and Output Logging
 *
 * Append-only store for AI prompts and outputs with indexing.
 * Encryption utilities for AES-256-GCM with tenant keys.
 * Attestia integration for cryptographic event logging.
 */

export type { PromptStoreState, StoreError, StoreResult } from "./store.js";
export type { EncryptedPayload } from "./crypto.js";
export type { AttestLogConfig } from "./attestation.js";
export {
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
} from "./store.js";
export {
  hashPlaintext,
  encrypt,
  decrypt,
  serializePayload,
  deserializePayload,
} from "./crypto.js";
export {
  attestLogPrompt,
  attestLogOutput,
} from "./attestation.js";
