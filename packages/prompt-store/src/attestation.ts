/**
 * Attestia integration for the prompt store.
 *
 * Wraps pure store functions with cryptographic event logging.
 * Each log operation is mirrored as an append-only Attestia event.
 */

import { randomUUID } from "node:crypto";
import type { Prompt, Output } from "@cognate/types";
import type { DomainEvent, EventStore } from "@mcptoolshop/attestia/event-store";
import type { PromptStoreState, StoreResult, StoreError } from "./store.js";
import { logPrompt, logOutput } from "./store.js";

function cognateEvent(
  type: string,
  actor: string,
  timestamp: string,
  correlationId: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return {
    type,
    metadata: {
      eventId: randomUUID(),
      timestamp,
      actor,
      correlationId,
      source: "external",
    },
    payload,
  };
}

export interface AttestLogConfig {
  readonly eventStore: Pick<EventStore, "append">;
  readonly tenantId: string;
  readonly streamPrefix?: string;
}

function makeStreamId(config: AttestLogConfig, suffix: string): string {
  return `${config.streamPrefix ?? "cognate"}-${config.tenantId}-${suffix}`;
}

function toStoreError(code: string, message: string, hint: string): StoreError {
  return { code, message, hint };
}

/**
 * Log a prompt and append the Attestia event.
 *
 * The next store is computed first. It is returned only after the append
 * succeeds. A failed append leaves the caller on the store they passed in.
 */
export async function attestLogPrompt(
  state: PromptStoreState,
  config: AttestLogConfig,
  prompt: Prompt
): Promise<StoreResult<void>> {
  const result = logPrompt(state, prompt);
  if (!result.ok) return result;

  try {
    await config.eventStore.append(
      makeStreamId(config, "prompts"),
      [
        cognateEvent(
          "cognate.prompt.logged",
          prompt.tenantId,
          prompt.submittedAt,
          prompt.id,
          {
            promptId: prompt.id,
            tenantId: prompt.tenantId,
            modelVersionId: prompt.modelVersionId,
            plaintextHash: prompt.plaintextHash,
            submittedAt: prompt.submittedAt,
          },
        ),
      ],
    );
  } catch (err) {
    return {
      ok: false,
      error: toStoreError(
        "attestia.append-failed",
        `Attestia append failed: ${err instanceof Error ? err.message : String(err)}`,
        "The prompt was not logged. The event store rejected the append."
      ),
      state,
    };
  }

  return result;
}

/**
 * Log an output to the store AND append a cryptographic event to Attestia.
 */
export async function attestLogOutput(
  state: PromptStoreState,
  config: AttestLogConfig,
  output: Output
): Promise<StoreResult<void>> {
  const result = logOutput(state, output);
  if (!result.ok) return result;

  try {
    await config.eventStore.append(
      makeStreamId(config, "outputs"),
      [
        cognateEvent(
          "cognate.output.logged",
          output.tenantId,
          output.generatedAt,
          output.id,
          {
            outputId: output.id,
            tenantId: output.tenantId,
            promptId: output.promptId,
            modelVersionId: output.modelVersionId,
            plaintextHash: output.plaintextHash,
            generatedAt: output.generatedAt,
          },
        ),
      ],
    );
  } catch (err) {
    return {
      ok: false,
      error: toStoreError(
        "attestia.append-failed",
        `Attestia append failed: ${err instanceof Error ? err.message : String(err)}`,
        "The output was not logged. The event store rejected the append."
      ),
      state,
    };
  }

  return result;
}
