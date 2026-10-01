/**
 * Process paths. Docker sets the same event-log variable Attestia's compose uses.
 * The three snapshots sit beside that log, under cognate/, and are not a second log.
 */

import { join } from "node:path";
import { JsonlEventStore } from "@mcptoolshop/attestia/event-store";
import type { EventStore } from "@mcptoolshop/attestia/event-store";
import { loadSnapshots, type SnapshotPaths, type SnapshotState } from "./snapshot.js";

export interface RuntimePaths extends SnapshotPaths {
  readonly eventsFile: string;
}

export function resolveRuntimePaths(
  env: Record<string, string | undefined>,
  cwd: string,
): RuntimePaths {
  const dataDir = env.COGNATE_DATA_DIR ?? join(cwd, "data");
  return {
    eventsFile: env.ATTESTIA_EVENTS_FILE ?? join(dataDir, "events.jsonl"),
    registry: env.COGNATE_MODEL_REGISTRY_PATH ?? join(dataDir, "cognate", "registry.json"),
    agents: env.COGNATE_AGENT_REGISTRY_PATH ?? join(dataDir, "cognate", "agents.json"),
    prompts: env.COGNATE_PROMPT_STORE_PATH ?? join(dataDir, "cognate", "prompts.json"),
  };
}

export function openRuntime(
  env: Record<string, string | undefined>,
  cwd: string,
): { state: SnapshotState; eventStore: EventStore; snapshots: SnapshotPaths; eventsFile: string } {
  const paths = resolveRuntimePaths(env, cwd);
  const snapshots: SnapshotPaths = {
    registry: paths.registry,
    agents: paths.agents,
    prompts: paths.prompts,
  };
  return {
    state: loadSnapshots(snapshots),
    eventStore: new JsonlEventStore({ filePath: paths.eventsFile }),
    snapshots,
    eventsFile: paths.eventsFile,
  };
}
