/**
 * Cognate Node — HTTP API Server Entry Point
 *
 * Opens Attestia's JSONL log and reloads the three snapshots from disk.
 */

import { verifyRelease } from "@cognate/repomesh-bridge";
import { signedRequestsConfigFromEnv } from "./middleware/signature.js";
import { releaseConfigFromEnv } from "./release-gate.js";
import { citationRuleFromEnv } from "./routes/evaluations.js";
import { openRuntime } from "./runtime.js";
import { createCognateServer, type ServerContext } from "./server.js";
import { failStartup } from "./startup-errors.js";

function start(): void {
  const port = Number(process.env.PORT ?? "4000");
  const host = process.env.HOST ?? "127.0.0.1";
  const runtime = openRuntime(process.env, process.cwd());
  const release = releaseConfigFromEnv(process.env);
  const signedRequestsCfg = signedRequestsConfigFromEnv(process.env);

  const ctx: ServerContext = {
    state: runtime.state,
    port,
    host,
    eventStore: runtime.eventStore,
    snapshots: runtime.snapshots,
    releaseFailOn: release.failOn,
    requireEvaluationCitations: citationRuleFromEnv(process.env),
    signedRequests: signedRequestsCfg.signedRequests,
    signedRequestsLogUntil: signedRequestsCfg.signedRequestsLogUntil,
    ...(process.env.COGNATE_TENANT_ROOTS_PATH?.trim()
      ? { tenantRootsPath: process.env.COGNATE_TENANT_ROOTS_PATH.trim() }
      : {}),
    verifyRelease: (repo, version) => verifyRelease(repo, version, release.repomesh),
  };

  const { server } = createCognateServer(ctx);

  server.listen(port, host, () => {
    console.log(`Cognate API listening on http://${host}:${port}`);
  });
}

try {
  start();
} catch (err) {
  failStartup(err);
}

export * from "./server.js";
