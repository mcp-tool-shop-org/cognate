/**
 * Startup failure reporting for the production entrypoint (src/index.ts).
 *
 * A configuration error at startup prints one JSON line on stderr in the same
 * shape the API's errors use ({ ok: false, error: { code, message, hint } })
 * and exits non-zero. The stack is added only when COGNATE_DEBUG=1 or --debug.
 */

export const GENERIC_STARTUP_CODE = "startup.invalid-configuration";
const GENERIC_STARTUP_HINT =
  "Check the environment variables and the files they point to (see the handbook's configuration section), then start again. Set COGNATE_DEBUG=1 or pass --debug to include the stack.";

function structured(err: unknown): { code: string; hint: string } | null {
  if (typeof err !== "object" || err === null) return null;
  const { code, hint } = err as { code?: unknown; hint?: unknown };
  return typeof code === "string" && typeof hint === "string" ? { code, hint } : null;
}

export function formatStartupFailure(err: unknown, debug: boolean): string {
  const known = structured(err);
  const message = err instanceof Error ? err.message : String(err);
  const line = JSON.stringify({
    ok: false,
    error: {
      code: known?.code ?? GENERIC_STARTUP_CODE,
      message,
      hint: known?.hint ?? GENERIC_STARTUP_HINT,
    },
  });
  return debug && err instanceof Error && err.stack ? `${line}\n${err.stack}` : line;
}

export function isDebug(env: Record<string, string | undefined>, argv: readonly string[]): boolean {
  return (env.COGNATE_DEBUG?.trim() ?? "") === "1" || argv.includes("--debug");
}

/** Print the failure and terminate the process with exit code 1. */
export function failStartup(err: unknown): never {
  process.stderr.write(`${formatStartupFailure(err, isDebug(process.env, process.argv.slice(2)))}\n`);
  process.exit(1);
}
