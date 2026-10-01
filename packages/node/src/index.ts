/**
 * Cognate Node — HTTP API Server Entry Point
 *
 * Opens Attestia's JSONL log and reloads the three snapshots from disk.
 */

import { verifyRelease } from "@cognate/repomesh-bridge";
import { releaseConfigFromEnv } from "./release-gate.js";
import { openRuntime } from "./runtime.js";
import { createCognateServer, type ServerContext } from "./server.js";

const port = Number(process.env.PORT ?? "4000");
const host = process.env.HOST ?? "127.0.0.1";
const runtime = openRuntime(process.env, process.cwd());
const release = releaseConfigFromEnv(process.env);

const ctx: ServerContext = {
  state: runtime.state,
  port,
  host,
  eventStore: runtime.eventStore,
  snapshots: runtime.snapshots,
  releaseFailOn: release.failOn,
  verifyRelease: (repo, version) => verifyRelease(repo, version, release.repomesh),
};

const { server } = createCognateServer(ctx);

server.listen(port, host, () => {
  console.log(`Cognate API listening on http://${host}:${port}`);
});

export { createCognateServer, type ServerContext, type ServerState } from "./server.js";
