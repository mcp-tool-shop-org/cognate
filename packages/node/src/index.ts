/**
 * Cognate Node — HTTP API Server Entry Point
 */

import { createRegistry as createModelRegistry } from "@cognate/model-registry";
import { createRegistry as createIdentityRegistry } from "@cognate/agent-identity";
import { createStore as createPromptStore } from "@cognate/prompt-store";
import { createCognateServer, type ServerContext } from "./server.js";

const port = Number(process.env.PORT ?? "4000");
const host = process.env.HOST ?? "127.0.0.1";

const ctx: ServerContext = {
  state: {
    registry: createModelRegistry(),
    identity: createIdentityRegistry(),
    prompts: createPromptStore(),
  },
  port,
  host,
};

const { server } = createCognateServer(ctx);

server.listen(port, host, () => {
  console.log(`Cognate API listening on http://${host}:${port}`);
});

export { createCognateServer, type ServerContext, type ServerState } from "./server.js";
