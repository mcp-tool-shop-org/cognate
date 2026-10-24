import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createRegistry,
  preRegisterRun,
  recordRunOutcome,
  getRunPreRegistration,
  getRunOutcomes,
  validateHashedIdentifiers,
  validateRunPreRegistration,
  validateRunOutcome,
  isSha256Hex,
  attestRunPreRegistered,
  attestRunCompleted,
  RegistryError,
} from "../src/index.js";
import type {
  ActorId,
  HashId,
  RunOutcome,
  RunPreRegistration,
  TenantId,
  Timestamp,
} from "@cognate/types";

function sha256(text: string): HashId {
  return createHash("sha256").update(text, "utf8").digest("hex") as HashId;
}

const TENANT = "tenant-1" as TenantId;
const APPROVER = "publisher" as ActorId;
const T_PREREG = "2026-10-24T01:00:00.000Z" as Timestamp;
const T_START = "2026-10-24T01:05:00.000Z" as Timestamp;
const T_PROGRESS = "2026-10-24T01:30:00.000Z" as Timestamp;
const T_END = "2026-10-24T02:05:00.000Z" as Timestamp;

function makePreRegistration(
  overrides: Partial<RunPreRegistration> = {},
): RunPreRegistration {
  return {
    id: "prereg-window-19a" as HashId,
    tenantId: TENANT,
    planSha256: sha256("launch.sh:window-19a-plan"),
    decisionSha256: sha256("B_false_refusals * 2 <= A_false_refusals"),
    caps: {
      maxUnits: 14.4,
      maxWallSeconds: 10800,
      margin: 0.5,
    },
    plannedCard: "A100",
    approvedBy: APPROVER,
    registeredAt: T_PREREG,
    ggufRepoSha256: sha256("private-owner/role-set-gguf"),
    hostedRepoSha256: sha256("private-owner/hosted-artifacts"),
    repoSha256: sha256("org-owner/role-set"),
    ggufSourceSha256: sha256("private-owner/role-set-gguf/model.gguf"),
    identifiers: {
      ggufRepoSha256: sha256("private-owner/role-set-gguf"),
      hostedRepoSha256: sha256("private-owner/hosted-artifacts"),
      repoSha256: sha256("org-owner/role-set"),
      ggufSourceSha256: sha256("private-owner/role-set-gguf/model.gguf"),
      hfRepoSha256: sha256("private-owner/role-set-gguf"),
      githubOwnerSha256: sha256("org-owner"),
      emailSha256: sha256("operator@example.org"),
      homePathSha256: sha256("/home/operator/work"),
    },
    models: [
      {
        servedAs: "critic-30b",
        repoSha256: sha256("org-owner/critic-model"),
        ggufSourceSha256: sha256("private-owner/role-set-gguf/critic.gguf"),
        revision: "d847f5b87a6b0f8cb9ae3ff5c6330bafb0364670",
        ggufSha256: sha256("gguf-weights-bytes"),
      },
    ],
    notes: "Pre-registered benchmark window 19a",
    ...overrides,
  };
}

function makeOutcome(overrides: Partial<RunOutcome> = {}): RunOutcome {
  return {
    id: "outcome-window-19a" as HashId,
    tenantId: TENANT,
    preRegistrationId: "prereg-window-19a" as HashId,
    status: "completed",
    startedAt: T_START,
    endedAt: T_END,
    recordedAt: T_END,
    outcomeSha256: sha256("outcome.json:window-19a"),
    cost: {
      unitsSpent: 6.29,
      rate: 6.29,
      basis: "rate_x_runtime",
      runtimeSeconds: 3600,
      unit: "colab_units",
    },
    retirement: null,
    ggufRepoSha256: sha256("private-owner/role-set-gguf"),
    hostedRepoSha256: sha256("private-owner/hosted-artifacts"),
    repoSha256: sha256("org-owner/role-set"),
    ggufSourceSha256: sha256("private-owner/role-set-gguf/model.gguf"),
    notes: "Completed benchmark run; false refusals 4/69 vs 9/69",
    ...overrides,
  };
}

describe("run lifecycle and attestRun* stream emitters", () => {
  it("walks the full lifecycle (pre-register -> in_progress -> completed) and links outcome to pre-registration", async () => {
    const appended: Array<{ streamId: string; events: unknown[] }> = [];
    const config = {
      tenantId: TENANT,
      eventStore: {
        async append(streamId: string, events: readonly unknown[]) {
          appended.push({ streamId, events: [...events] });
          return { streamId, fromVersion: 1, toVersion: 1, count: events.length };
        },
      },
    };

    let state = createRegistry();
    const prereg = makePreRegistration();
    state = await attestRunPreRegistered(state, config, prereg);
    expect(getRunPreRegistration(state, prereg.id)).toEqual(prereg);

    const inProgress = makeOutcome({
      id: "outcome-window-19a-progress" as HashId,
      status: "in_progress",
      endedAt: null,
      recordedAt: T_PROGRESS,
      outcomeSha256: null,
      cost: {
        unitsSpent: 0,
        rate: 6.29,
        basis: "pending",
        runtimeSeconds: 1500,
        unit: "colab_units",
      },
    });
    state = recordRunOutcome(state, inProgress);
    expect(getRunOutcomes(state, prereg.id)).toHaveLength(1);
    expect(getRunOutcomes(state, prereg.id)[0]?.status).toBe("in_progress");

    const completed = makeOutcome();
    state = await attestRunCompleted(state, config, completed);

    const outcomes = getRunOutcomes(state, prereg.id);
    expect(outcomes).toHaveLength(2);
    expect(outcomes[1]?.status).toBe("completed");
    expect(outcomes[1]?.preRegistrationId).toBe(prereg.id);
    expect(outcomes[1]?.cost).toEqual({
      unitsSpent: 6.29,
      rate: 6.29,
      basis: "rate_x_runtime",
      runtimeSeconds: 3600,
      unit: "colab_units",
    });

    expect(appended).toHaveLength(2);
    expect(appended[0]?.streamId).toBe("cognate-tenant-1-runs");
    expect(appended[1]?.streamId).toBe("cognate-tenant-1-runs");

    const preregEvent = appended[0]?.events[0] as {
      type: string;
      metadata: { source: string; correlationId: string; actor: string; timestamp: string };
      payload: Record<string, unknown>;
    };
    expect(preregEvent.type).toBe("cognate.run.preregistered");
    expect(preregEvent.metadata.source).toBe("external");
    expect(preregEvent.metadata.correlationId).toBe(prereg.id);
    expect(preregEvent.metadata.actor).toBe(APPROVER);
    expect(preregEvent.metadata.timestamp).toBe(T_PREREG);
    expect(preregEvent.payload.planSha256).toBe(prereg.planSha256);
    expect(preregEvent.payload.decisionSha256).toBe(prereg.decisionSha256);
    expect(preregEvent.payload.plannedCard).toBe("A100");

    const completedEvent = appended[1]?.events[0] as {
      type: string;
      metadata: {
        source: string;
        correlationId: string;
        causationId?: string;
        actor: string;
        timestamp: string;
      };
      payload: Record<string, unknown>;
    };
    expect(completedEvent.type).toBe("cognate.run.completed");
    expect(completedEvent.metadata.source).toBe("external");
    expect(completedEvent.metadata.correlationId).toBe(prereg.id);
    expect(completedEvent.metadata.causationId).toBe(prereg.id);
    expect(completedEvent.payload.preRegistrationId).toBe(prereg.id);
    expect(completedEvent.payload.status).toBe("completed");
    expect(completedEvent.payload.outcomeSha256).toBe(completed.outcomeSha256);
  });

  it("records cancelled, lost, and retired run outcomes linked to their pre-registrations", async () => {
    const appended: Array<{ streamId: string; events: unknown[] }> = [];
    const config = {
      tenantId: TENANT,
      streamPrefix: "lab",
      eventStore: {
        async append(streamId: string, events: readonly unknown[]) {
          appended.push({ streamId, events: [...events] });
          return { streamId, fromVersion: 1, toVersion: 1, count: events.length };
        },
      },
    };

    let state = createRegistry();
    const preregCancelled = makePreRegistration({ id: "prereg-20a" as HashId });
    const preregLost = makePreRegistration({ id: "prereg-lost" as HashId });
    state = preRegisterRun(state, preregCancelled);
    state = preRegisterRun(state, preregLost);

    const cancelledOutcome = makeOutcome({
      id: "outcome-20a-cancelled" as HashId,
      preRegistrationId: preregCancelled.id,
      status: "cancelled",
      outcomeSha256: null,
      cost: {
        unitsSpent: 0.46,
        rate: 6.88,
        basis: "rate_x_runtime",
        runtimeSeconds: 240,
        unit: "colab_units",
      },
      retirement: {
        reason: "Stopped after 4 minutes under single-job policy",
        retiredAt: T_END,
        retiredBy: APPROVER,
        sha256: sha256("RETIRED.txt:window-19y"),
      },
      retirementReason: "Stopped after 4 minutes under single-job policy",
    });

    state = await attestRunCompleted(state, config, cancelledOutcome);
    expect(appended[0]?.streamId).toBe("lab-tenant-1-runs");
    expect(getRunOutcomes(state, preregCancelled.id)[0]?.status).toBe("cancelled");
    expect(getRunOutcomes(state, preregCancelled.id)[0]?.retirement?.reason).toContain(
      "single-job policy",
    );

    const lostOutcome = makeOutcome({
      id: "outcome-lost-1" as HashId,
      preRegistrationId: preregLost.id,
      status: "lost",
      outcomeSha256: null,
      cost: {
        unitsSpent: 1.25,
        rate: 5.0,
        basis: "estimate",
        runtimeSeconds: 900,
      },
    });
    state = recordRunOutcome(state, lostOutcome);
    expect(getRunOutcomes(state, preregLost.id)[0]?.status).toBe("lost");
  });

  it("supports direct stateless attestRunPreRegistered and attestRunCompleted calls", async () => {
    const events: unknown[] = [];
    const config = {
      tenantId: TENANT,
      eventStore: {
        async append(_streamId: string, batch: readonly unknown[]) {
          events.push(...batch);
          return { streamId: "cognate-tenant-1-runs", fromVersion: 1, toVersion: 1, count: 1 };
        },
      },
    };
    const prereg = makePreRegistration();
    const outcome = makeOutcome({ recordedBy: "operator-seat" as ActorId });

    const resPre = await attestRunPreRegistered(config, prereg);
    expect(resPre.streamId).toBe("cognate-tenant-1-runs");
    expect(resPre.eventId).toMatch(/^[0-9a-f-]{36}$/);

    const resOut = await attestRunCompleted(config, outcome, prereg);
    expect(resOut.streamId).toBe("cognate-tenant-1-runs");
    expect(resOut.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(events).toHaveLength(2);

    await expect(
      attestRunPreRegistered(
        config,
        makePreRegistration({ tenantId: "other-tenant" as TenantId }),
      ),
    ).rejects.toBeInstanceOf(RegistryError);

    await expect(
      attestRunCompleted(
        config,
        makeOutcome({ tenantId: "other-tenant" as TenantId }),
        makePreRegistration({ tenantId: "other-tenant" as TenantId }),
      ),
    ).rejects.toBeInstanceOf(RegistryError);
  });

  it("requires preRegistration in stateless attestRunCompleted and refuses calls with no state and no preRegistration", async () => {
    const config = {
      tenantId: TENANT,
      eventStore: {
        async append() {
          return { streamId: "cognate-tenant-1-runs", fromVersion: 1, toVersion: 1, count: 1 };
        },
      },
    };
    const prereg = makePreRegistration();
    const outcome = makeOutcome();

    await expect(
      (attestRunCompleted as unknown as (c: unknown, o: unknown) => Promise<unknown>)(
        config,
        outcome,
      ),
    ).rejects.toMatchObject({
      name: "RegistryError",
      code: "PREREGISTRATION_NOT_FOUND",
    });

    await expect(
      attestRunCompleted(
        config,
        makeOutcome({ preRegistrationId: "other-prereg" as HashId }),
        prereg,
      ),
    ).rejects.toMatchObject({
      name: "RegistryError",
      code: "PREREGISTRATION_MISMATCH",
    });
  });

  it("refuses terminal-to-terminal run outcome transitions (completed, cancelled, or lost cannot record another outcome)", () => {
    const prereg = makePreRegistration();
    const baseState = preRegisterRun(createRegistry(), prereg);

    const stateAfterCompleted = recordRunOutcome(
      baseState,
      makeOutcome({ id: "out-completed" as HashId, status: "completed" }),
    );
    for (const nextStatus of ["completed", "cancelled", "lost"] as const) {
      expect(() =>
        recordRunOutcome(
          stateAfterCompleted,
          makeOutcome({
            id: `out-after-completed-${nextStatus}` as HashId,
            status: nextStatus,
            outcomeSha256: nextStatus === "completed" ? sha256("second") : null,
          }),
        ),
      ).toThrowError(/already reached.*terminal state/i);
    }

    const stateAfterCancelled = recordRunOutcome(
      baseState,
      makeOutcome({
        id: "out-cancelled" as HashId,
        status: "cancelled",
        outcomeSha256: null,
      }),
    );
    expect(() =>
      recordRunOutcome(
        stateAfterCancelled,
        makeOutcome({ id: "out-cancelled-to-completed" as HashId, status: "completed" }),
      ),
    ).toThrow(RegistryError);

    const stateAfterLost = recordRunOutcome(
      baseState,
      makeOutcome({
        id: "out-lost" as HashId,
        status: "lost",
        outcomeSha256: null,
      }),
    );
    expect(() =>
      recordRunOutcome(
        stateAfterLost,
        makeOutcome({ id: "out-lost-to-cancelled" as HashId, status: "cancelled", outcomeSha256: null }),
      ),
    ).toThrow(RegistryError);
  });

  it("refuses an outcome that does not reference a valid pre-registration or regresses from terminal state", () => {
    let state = createRegistry();
    const prereg = makePreRegistration();
    state = preRegisterRun(state, prereg);

    expect(() => preRegisterRun(state, prereg)).toThrow(RegistryError);

    expect(() =>
      recordRunOutcome(
        state,
        makeOutcome({ preRegistrationId: "missing-prereg" as HashId }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({ preRegistrationId: "other-prereg" as HashId }),
        prereg,
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({ tenantId: "other-tenant" as TenantId }),
        prereg,
      ),
    ).toThrow(RegistryError);

    const outcome = makeOutcome();
    state = recordRunOutcome(state, outcome);
    expect(() => recordRunOutcome(state, outcome)).toThrow(RegistryError);

    expect(() =>
      recordRunOutcome(
        state,
        makeOutcome({
          id: "outcome-regression" as HashId,
          status: "in_progress",
          endedAt: null,
          outcomeSha256: null,
        }),
      ),
    ).toThrow(RegistryError);
  });

  it("leaves state untouched and throws RegistryError when Attestia append fails", async () => {
    let state = createRegistry();
    const prereg = makePreRegistration();
    const failingConfig = {
      tenantId: TENANT,
      eventStore: {
        async append() {
          throw new Error("disk full");
        },
      },
    };
    const stringFailingConfig = {
      tenantId: TENANT,
      eventStore: {
        async append() {
          throw "raw append error";
        },
      },
    };

    await expect(
      attestRunPreRegistered(state, failingConfig, prereg),
    ).rejects.toBeInstanceOf(RegistryError);
    await expect(
      attestRunPreRegistered(state, stringFailingConfig, prereg),
    ).rejects.toBeInstanceOf(RegistryError);
    expect(getRunPreRegistration(state, prereg.id)).toBeUndefined();

    state = preRegisterRun(state, prereg);
    await expect(
      attestRunCompleted(state, failingConfig, makeOutcome()),
    ).rejects.toBeInstanceOf(RegistryError);
    await expect(
      attestRunCompleted(state, stringFailingConfig, makeOutcome()),
    ).rejects.toBeInstanceOf(RegistryError);
    expect(getRunOutcomes(state, prereg.id)).toHaveLength(0);
  });
});

describe("hashed-identifier rule (New 4) and no-balance rule", () => {
  it("accepts valid 64-char lowercase hex SHA-256 digests in all identifier fields", () => {
    expect(isSha256Hex(sha256("private-owner/role-set-gguf"))).toBe(true);
    expect(isSha256Hex("not-a-sha")).toBe(false);
    expect(isSha256Hex("A".repeat(64))).toBe(false);

    const prereg = makePreRegistration();
    const outcome = makeOutcome();
    expect(() => validateHashedIdentifiers(prereg)).not.toThrow();
    expect(() => validateRunPreRegistration(prereg)).not.toThrow();
    expect(() => validateRunOutcome(outcome, prereg)).not.toThrow();
  });

  it("refuses plaintext values in ggufRepoSha256, hostedRepoSha256, repoSha256, and ggufSourceSha256", () => {
    for (const field of [
      "ggufRepoSha256",
      "hostedRepoSha256",
      "repoSha256",
      "ggufSourceSha256",
    ] as const) {
      const badPrereg = makePreRegistration({
        [field]: "plain-owner/plain-repo" as unknown as HashId,
      });
      expect(() => validateRunPreRegistration(badPrereg)).toThrow(RegistryError);
      try {
        validateRunPreRegistration(badPrereg);
      } catch (err) {
        expect((err as RegistryError).code).toBe("PLAINTEXT_ACCOUNT_IDENTIFIER");
      }

      const badOutcome = makeOutcome({
        [field]: "plain-owner/plain-repo" as unknown as HashId,
      });
      expect(() => validateRunOutcome(badOutcome)).toThrow(RegistryError);
    }

    expect(() =>
      validateRunPreRegistration(
        makePreRegistration({
          planSha256: "plain-owner/plan-repo" as unknown as HashId,
        }),
      ),
    ).toThrow(RegistryError);
  });

  it("refuses records carrying unhashed account-naming field keys even when value is a hash", () => {
    const forbiddenKeys = [
      "ggufRepo",
      "gguf_source",
      "ggufSource",
      "hostedRepo",
      "hfRepo",
      "repo",
      "githubOwner",
      "account",
      "email",
      "authorEmail",
      "homePath",
    ];

    for (const key of forbiddenKeys) {
      const withRawKey = {
        ...makePreRegistration(),
        [key]: sha256("still-forbidden-key"),
      } as unknown as RunPreRegistration;

      expect(() => validateRunPreRegistration(withRawKey)).toThrow(RegistryError);
      try {
        validateRunPreRegistration(withRawKey);
      } catch (err) {
        expect((err as RegistryError).code).toBe("PLAINTEXT_ACCOUNT_IDENTIFIER");
      }
    }
  });

  it("refuses HF repo ids, GitHub owners, emails, and home paths in any string field", () => {
    const winHome = ["C:", "Users", "operator", "weights.gguf"].join("\\");
    const macHome = ["", "Users", "operator", "weights.gguf"].join("/");
    const linuxHome = ["", "home", "operator", "weights.gguf"].join("/");
    const tildeHome = "~/models/weights.gguf";

    const plaintextSamples = [
      "private-owner/role-set-gguf",
      "https://huggingface.co/private-owner/model",
      "https://github.com/org-owner/repo",
      "operator@example.org",
      "@github-handle",
      winHome,
      macHome,
      linuxHome,
      tildeHome,
    ];

    for (const sample of plaintextSamples) {
      expect(() =>
        validateRunPreRegistration(makePreRegistration({ notes: `Loaded from ${sample}` })),
      ).toThrow(RegistryError);

      expect(() =>
        validateRunOutcome(
          makeOutcome({
            retirement: { reason: `Retired because ${sample} was replaced` },
          }),
        ),
      ).toThrow(RegistryError);
    }
  });

  it("refuses records that include startBalance, endBalance, or balance-based fields", () => {
    const withStartBalance = {
      ...makePreRegistration(),
      startBalanceBeforeLaunch: 100.0,
    } as unknown as RunPreRegistration;
    expect(() => validateRunPreRegistration(withStartBalance)).toThrow(RegistryError);

    for (const balanceKey of ["startBalance", "endBalance", "accountBalance"]) {
      const badOutcome = {
        ...makeOutcome(),
        [balanceKey]: 100.0,
      } as unknown as RunOutcome;
      expect(() => validateRunOutcome(badOutcome)).toThrow(RegistryError);
      try {
        validateRunOutcome(badOutcome);
      } catch (err) {
        expect((err as RegistryError).code).toBe("RUN_BALANCE_FORBIDDEN");
      }
    }

    const balanceBasisOutcome = makeOutcome({
      cost: {
        unitsSpent: 5,
        rate: 5,
        basis: "balance" as unknown as RunOutcome["cost"]["basis"],
      },
    });
    expect(() => validateRunOutcome(balanceBasisOutcome)).toThrow(RegistryError);
  });

  it("validates pre-registration caps, digests, and outcome cost invariants", () => {
    expect(() =>
      validateRunPreRegistration(
        makePreRegistration({ id: "   " as HashId }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunPreRegistration(
        makePreRegistration({ planSha256: "short" as HashId }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunPreRegistration(
        makePreRegistration({ decisionSha256: "short" as HashId }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunPreRegistration(
        makePreRegistration({ caps: { maxUnits: -1, maxWallSeconds: 100 } }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunPreRegistration(
        makePreRegistration({ caps: { maxUnits: 1, maxWallSeconds: 0 } }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunPreRegistration(
        makePreRegistration({ caps: { maxUnits: 1, maxWallSeconds: 60, margin: -1 } }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({
          status: "unknown-state" as unknown as RunOutcome["status"],
        }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({
          cost: null as unknown as RunOutcome["cost"],
        }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({
          cost: { unitsSpent: -0.1, rate: 5, basis: "rate_x_runtime" },
        }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({
          cost: { unitsSpent: 1, rate: -1, basis: "rate_x_runtime" },
        }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({
          cost: { unitsSpent: 1, rate: 1, basis: "rate_x_runtime", runtimeSeconds: -5 },
        }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({
          status: "completed",
          outcomeSha256: null,
        }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({
          status: "in_progress",
          endedAt: T_END,
        }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({
          retirement: { reason: "   " },
        }),
      ),
    ).toThrow(RegistryError);

    expect(() =>
      validateRunOutcome(
        makeOutcome({
          retirementReason: "   ",
        }),
      ),
    ).toThrow(RegistryError);
  });

  it("allows run labels, version pairs, path fragments, and ratios in free text while refusing true owner/repo slugs", () => {
    const falsePositiveStrings = [
      "19a/19r",
      "20a/20b",
      "w19a/w19r",
      "armA/armB",
      "E5/gemma4:31b/e5-2026-10-13b",
      "B 4/69 vs A 9/69",
      "11/138 vs 18/138",
      "v1.0/v1.1",
      "v0.1.8/v0.2.0",
      "node22/pnpm10",
      "A100/L4",
      "H100/B200",
      "FP16/BF16",
      "Q4_K_M/Q8_0",
      "CPU/GPU",
      "stub/lane.log",
      "results/outcome.json",
      "packages/model-registry",
      "src/registry.ts",
      "/policy/evaluate",
      "receipts/e5-2026-10-13b.jsonl",
      "tokens/sec",
      "units/hr",
      "6.29u/hr",
      "GB/s",
      "MiB/s",
      "GB/sec",
      "MiB/sec",
      "req/min",
      "pass/fail",
      "train/val",
      "read/write",
      "yes/no",
      "true/false",
      "on/off",
      "in/out",
      "dev/prod",
      "TCP/IP",
      "HTTP/1.1",
      "N/A",
      "I/O",
      "foo-/bar",
    ];

    for (const allowed of falsePositiveStrings) {
      expect(() =>
        validateRunPreRegistration(makePreRegistration({ notes: `Window note: ${allowed}` })),
      ).not.toThrow();
      expect(() =>
        validateRunOutcome(makeOutcome({ notes: `Outcome note: ${allowed}` })),
      ).not.toThrow();
    }

    const truePositiveSlugs = [
      "meta-llama/Llama-3-8B",
      "TheBloke/Mistral-7B-Instruct-v0.2-GGUF",
      "bartowski/Qwen2.5-7B-Instruct-GGUF/Qwen2.5-7B-Instruct-Q4_K_M.gguf",
      "mistralai/Mixtral-8x7B-v0.1",
      "google/gemma-2-27b-it",
      "Qwen/Qwen2.5-Coder-32B-Instruct",
      "deepseek-ai/DeepSeek-R1",
      "mcp-tool-shop-org/cognate",
      "mcp-tool-shop-org/attestia",
      "mcp-tool-shop-org/repomesh",
      "octocat/Hello-World",
      "torvalds/linux",
      "org_name/private-gguf-repo",
      "user123/my_model.gguf",
      "owner/a",
      "owner/123",
    ];

    for (const slug of truePositiveSlugs) {
      expect(() =>
        validateRunPreRegistration(makePreRegistration({ notes: `Model ${slug}` })),
      ).toThrowError(/PLAINTEXT_ACCOUNT_IDENTIFIER|plaintext account-naming identifier/i);
    }
  });

  it("refuses any key containing balance in any case or separator form", () => {
    const balanceKeys = [
      "balance",
      "startingBalance",
      "starting_balance",
      "endingBalance",
      "ending_balance",
      "remainingBalance",
      "remaining_balance",
      "initialBalance",
      "initial_balance",
      "finalBalance",
      "final_balance",
      "start_balance_before_launch",
      "endBalanceAfterRun",
      "colabBalance",
      "colab_balance",
      "unit-balance",
      "WALLET_BALANCE",
      "creditBalance",
    ];

    for (const key of balanceKeys) {
      const badRecord = {
        ...makeOutcome(),
        [key]: 42,
      } as unknown as RunOutcome;
      expect(() => validateRunOutcome(badRecord)).toThrow(RegistryError);
      try {
        validateRunOutcome(badRecord);
      } catch (err) {
        expect((err as RegistryError).code).toBe("RUN_BALANCE_FORBIDDEN");
      }
    }
  });

  it("refuses unhashed account keys (owner, repoOwner, githubUser, hfOwner, username, user, author, handle) and requires hashes in *Sha256 counterparts", () => {
    const accountKeys = [
      "owner",
      "repoOwner",
      "repo_owner",
      "githubUser",
      "github_user",
      "hfOwner",
      "hf_owner",
      "hfUser",
      "hf_user",
      "username",
      "user_name",
      "user",
      "author",
      "handle",
      "githubHandle",
      "hfHandle",
    ];

    for (const key of accountKeys) {
      const withRawKey = {
        ...makePreRegistration(),
        [key]: "octocat",
      } as unknown as RunPreRegistration;
      expect(() => validateRunPreRegistration(withRawKey)).toThrow(RegistryError);
      try {
        validateRunPreRegistration(withRawKey);
      } catch (err) {
        expect((err as RegistryError).code).toBe("PLAINTEXT_ACCOUNT_IDENTIFIER");
      }
    }

    const hashedKeys = [
      "ownerSha256",
      "repoOwnerSha256",
      "githubUserSha256",
      "hfOwnerSha256",
      "usernameSha256",
    ] as const;

    for (const hKey of hashedKeys) {
      const badHashed = {
        ...makePreRegistration(),
        [hKey]: "octocat",
      } as unknown as RunPreRegistration;
      expect(() => validateRunPreRegistration(badHashed)).toThrow(RegistryError);

      const goodHashed = {
        ...makePreRegistration(),
        [hKey]: sha256("octocat"),
      } as unknown as RunPreRegistration;
      expect(() => validateRunPreRegistration(goodHashed)).not.toThrow();
    }
  });

  it("refuses @handle tokens after punctuation and allows Windows Public and Default profile paths", () => {
    const punctuatedHandles = [
      '"@octocat"',
      "'@octocat'",
      "owner:@octocat",
      "[@octocat]",
      "(@octocat)",
      "=@octocat",
      ",@octocat",
    ];

    for (const h of punctuatedHandles) {
      expect(() =>
        validateRunPreRegistration(makePreRegistration({ notes: `Reviewed by ${h}` })),
      ).toThrow(RegistryError);
    }

    const publicPaths = [
      ["C:", "Users", "Public", "models", "weights.gguf"].join("\\"),
      ["C:", "Users", "Default", "models", "weights.gguf"].join("\\"),
      ["C:", "Users", "All Users", "models", "weights.gguf"].join("\\"),
      ["", "Users", "Public", "models", "weights.gguf"].join("/"),
      ["", "Users", "Default", "models", "weights.gguf"].join("/"),
    ];

    for (const pub of publicPaths) {
      expect(() =>
        validateRunPreRegistration(makePreRegistration({ notes: `Shared path ${pub}` })),
      ).not.toThrow();
    }
  });
});
