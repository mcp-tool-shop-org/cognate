/**
 * Deploy gate. RepoMesh reports a status. Cognate decides whether that
 * status may move an approved version to deployed.
 *
 * `accepted` means the gate will attempt the transition. The transition
 * event is the deploy. If that later append fails, this check can remain
 * with accepted true while the version stays approved.
 */

import { randomUUID } from "node:crypto";
import type { DomainEvent, EventStore } from "@mcptoolshop/attestia/event-store";

export type ReleaseFailOn = "fail" | "unverified";

export interface ReleaseCheckerConfig {
  readonly ledgerUrl?: string;
  readonly localPath?: string;
  readonly anchored: boolean;
}

export interface ReleaseRuntimeConfig {
  readonly failOn: ReleaseFailOn;
  readonly repomesh: ReleaseCheckerConfig;
}

/** Only the exact string "fail" is relaxed. Everything else requires PASS. */
export function parseReleaseFailOn(value: string | undefined): ReleaseFailOn {
  return value === "fail" ? "fail" : "unverified";
}

export function releaseAccepted(status: string, failOn: ReleaseFailOn): boolean {
  if (status === "PASS") return true;
  if (status === "UNVERIFIED" && failOn === "fail") return true;
  return false;
}

export function releaseConfigFromEnv(env: Record<string, string | undefined>): ReleaseRuntimeConfig {
  const ledger = env.REPOMESH_LEDGER_URL?.trim();
  const local = env.REPOMESH_LOCAL_PATH?.trim();
  return {
    failOn: parseReleaseFailOn(env.REPOMESH_FAIL_ON),
    repomesh: {
      anchored: env.REPOMESH_ANCHORED === "true",
      ...(ledger ? { ledgerUrl: ledger } : {}),
      ...(local ? { localPath: local } : {}),
    },
  };
}

export interface CheckDeployInput {
  readonly eventStore: Pick<EventStore, "append">;
  readonly verifyRelease: (repo: string, version: string) => Promise<{ status: string }>;
  readonly failOn: ReleaseFailOn;
  readonly tenantId: string;
  readonly actorId: string;
  readonly modelVersionId: string;
  readonly repo: string;
  readonly release: string;
}

export type DeployCheckResult =
  | { readonly kind: "check-failed"; readonly message: string }
  | { readonly kind: "append-failed"; readonly message: string }
  | {
      readonly kind: "checked";
      readonly accepted: boolean;
      readonly status: string;
      readonly eventId: string;
      readonly repo: string;
      readonly release: string;
    };

export async function checkDeploy(input: CheckDeployInput): Promise<DeployCheckResult> {
  let status: string;
  try {
    const raw = await input.verifyRelease(input.repo, input.release);
    status = typeof raw?.status === "string" && raw.status.length > 0 ? raw.status : "UNVERIFIED";
  } catch (err) {
    return {
      kind: "check-failed",
      message: `RepoMesh check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const accepted = releaseAccepted(status, input.failOn);
  const eventId = randomUUID();
  const event: DomainEvent = {
    type: "cognate.release.checked",
    metadata: {
      eventId,
      timestamp: new Date().toISOString(),
      actor: input.actorId,
      correlationId: input.modelVersionId,
      source: "external",
    },
    payload: {
      modelVersionId: input.modelVersionId,
      repo: input.repo,
      release: input.release,
      status,
      accepted,
    },
  };

  try {
    await input.eventStore.append(`cognate-${input.tenantId}-releases`, [event]);
  } catch (err) {
    return {
      kind: "append-failed",
      message: `Attestia append failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {
    kind: "checked",
    accepted,
    status,
    eventId,
    repo: input.repo,
    release: input.release,
  };
}
