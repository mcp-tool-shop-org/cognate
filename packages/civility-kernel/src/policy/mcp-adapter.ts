import type { Plan } from "./types.js";
import type { FeedbackEvent } from "./learning.js";

export interface McpToolCall {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolResult {
  content: unknown;
  isError?: boolean;
}

export function planFromMcpToolCall(
  call: McpToolCall,
  meta?: Partial<Plan["meta"]>
): Plan {
  return {
    id: call.name,
    summary: call.name,
    steps: [
      {
        kind: call.name,
        detail: call.arguments ? JSON.stringify(call.arguments) : "{}",
      },
    ],
    meta: {
      tags: [],
      ...meta,
    },
  };
}

export function feedbackFromMcpResult(
  result: McpToolResult,
  planId: string
): FeedbackEvent {
  return {
    type: result.isError ? "UNDO" : "CHOOSE_PLAN",
    editedPlanId: planId,
    timestamp: new Date().toISOString(),
  };
}
