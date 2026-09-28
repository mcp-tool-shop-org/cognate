import {
  createStore as createPromptStore,
  logPrompt,
  logOutput,
} from "@cognate/prompt-store";
import type { Prompt, Output } from "@cognate/types";
import type { ServerState } from "../server.js";

interface RouteResult<T> {
  ok: boolean;
  value?: T;
  error?: { code: string; message: string; hint: string };
  state?: ReturnType<typeof createPromptStore>;
}

export function handlePrompts(
  mutableState: ServerState,
  pathname: string,
  method: string,
  body: unknown
): RouteResult<unknown> {
  if (pathname === "/prompts" && method === "POST") {
    const req = body as { prompt?: Prompt };
    if (!req.prompt) {
      return { ok: false, error: { code: "prompts.missing-prompt", message: "Missing prompt", hint: "Provide a prompt object" } };
    }
    const result = logPrompt(mutableState.prompts, req.prompt);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message, hint: result.error.hint } };
    }
    return { ok: true, value: { id: req.prompt.id }, state: result.state };
  }

  if (pathname.startsWith("/prompts/") && pathname.endsWith("/outputs") && method === "POST") {
    const parts = pathname.split("/");
    const promptId = parts[2];
    const req = body as { output?: Output };
    if (!req.output) {
      return { ok: false, error: { code: "prompts.missing-output", message: "Missing output", hint: "Provide an output object" } };
    }
    const result = logOutput(mutableState.prompts, req.output);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message, hint: result.error.hint } };
    }
    return { ok: true, value: { id: req.output.id, promptId }, state: result.state };
  }

  return { ok: false, error: { code: "prompts.not-found", message: "Route not found", hint: "Check URL" } };
}
