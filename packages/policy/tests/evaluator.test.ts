import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../src/evaluator.js";
import type { Policy, EvaluationContext } from "../src/index.js";

const now = "2026-09-28T12:00:00.000Z";

function baseContext(overrides?: Partial<EvaluationContext>): EvaluationContext {
  return {
    tenantId: "tenant-1" as EvaluationContext["tenantId"],
    actorId: "actor-1" as EvaluationContext["actorId"],
    modelVersionId: "model-v1" as EvaluationContext["modelVersionId"],
    agentId: null,
    timestamp: now,
    promptText: "Hello, world!",
    outputText: null,
    metadata: {
      tokensIn: 3,
      tokensOut: null,
      latencyMs: 150,
      confidence: null,
      finishReason: null,
      tags: [],
    },
    agentCapabilities: [],
    counters: {
      callsInWindow: 0,
      windowSeconds: 3600,
      spendInWindow: 0,
      spendCurrency: "USD",
    },
    ...overrides,
  };
}

describe("evaluatePolicy", () => {
  it("allows when no rules match", () => {
    const policy: Policy = {
      id: "policy-1" as Policy["id"],
      tenantId: "tenant-1" as Policy["tenantId"],
      name: "Empty Policy",
      version: 1,
      rules: [],
      createdAt: now,
      approvedBy: "admin" as Policy["approvedBy"],
      status: "active",
    };

    const result = evaluatePolicy(policy, baseContext());

    expect(result.overall).toBe("allow");
    expect(result.matchedRules).toHaveLength(0);
    expect(result.blockingRules).toHaveLength(0);
  });

  it("blocks via regex content filter", () => {
    const policy: Policy = {
      id: "policy-1" as Policy["id"],
      tenantId: "tenant-1" as Policy["tenantId"],
      name: "Content Filter",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "content-filter",
          target: { kind: "global" },
          condition: { kind: "regex", pattern: "investment advice" },
          action: "deny",
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin" as Policy["approvedBy"],
      status: "active",
    };

    const ctx = baseContext({ promptText: "Give me investment advice please" });
    const result = evaluatePolicy(policy, ctx);

    expect(result.overall).toBe("deny");
    expect(result.matchedRules).toHaveLength(1);
    expect(result.blockingRules).toHaveLength(1);
    expect(result.matchedRules[0].reason).toContain("Regex matched");
  });

  it("does not block when regex does not match", () => {
    const policy: Policy = {
      id: "policy-1" as Policy["id"],
      tenantId: "tenant-1" as Policy["tenantId"],
      name: "Content Filter",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "content-filter",
          target: { kind: "global" },
          condition: { kind: "regex", pattern: "investment advice" },
          action: "deny",
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin" as Policy["approvedBy"],
      status: "active",
    };

    const result = evaluatePolicy(policy, baseContext({ promptText: "Hello, how are you?" }));

    expect(result.overall).toBe("allow");
    expect(result.matchedRules).toHaveLength(0);
  });

  it("blocks via keyword match", () => {
    const policy: Policy = {
      id: "policy-1" as Policy["id"],
      tenantId: "tenant-1" as Policy["tenantId"],
      name: "Keyword Filter",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "content-filter",
          target: { kind: "global" },
          condition: { kind: "keyword", words: ["password", "secret"] },
          action: "deny",
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin" as Policy["approvedBy"],
      status: "active",
    };

    const ctx = baseContext({ promptText: "What is your password?" });
    const result = evaluatePolicy(policy, ctx);

    expect(result.overall).toBe("deny");
    expect(result.matchedRules[0].reason).toContain("Keywords found");
    expect(result.matchedRules[0].reason).toContain("password");
  });

  it("blocks via rate limit threshold", () => {
    const policy: Policy = {
      id: "policy-1" as Policy["id"],
      tenantId: "tenant-1" as Policy["tenantId"],
      name: "Rate Limit",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "rate-limit",
          target: { kind: "tenant", tenantId: "tenant-1" as Policy["tenantId"] },
          condition: {
            kind: "threshold",
            metric: "callsInWindow",
            operator: "gte",
            value: 100,
          },
          action: "deny",
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin" as Policy["approvedBy"],
      status: "active",
    };

    const ctx = baseContext({ counters: { callsInWindow: 150, windowSeconds: 3600, spendInWindow: 0, spendCurrency: "USD" } });
    const result = evaluatePolicy(policy, ctx);

    expect(result.overall).toBe("deny");
    expect(result.matchedRules[0].reason).toContain("callsInWindow = 150 gte 100");
  });

  it("requires human review via latency threshold", () => {
    const policy: Policy = {
      id: "policy-1" as Policy["id"],
      tenantId: "tenant-1" as Policy["tenantId"],
      name: "Latency Guardrail",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "guardrail",
          target: { kind: "global" },
          condition: {
            kind: "threshold",
            metric: "latencyMs",
            operator: "gt",
            value: 5000,
          },
          action: "require-human-review",
          severity: "flag",
        },
      ],
      createdAt: now,
      approvedBy: "admin" as Policy["approvedBy"],
      status: "active",
    };

    const ctx = baseContext({ metadata: { ...baseContext().metadata, latencyMs: 8000 } });
    const result = evaluatePolicy(policy, ctx);

    expect(result.overall).toBe("require-human-review");
  });

  it("only applies rules matching target tenant", () => {
    const policy = {
      id: "policy-1",
      tenantId: "tenant-1",
      name: "Tenant Scoped",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "content-filter",
          target: { kind: "tenant", tenantId: "tenant-2" },
          condition: { kind: "regex", pattern: ".*" },
          action: "deny",
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin",
      status: "active",
    };
    const result = evaluatePolicy(policy, baseContext());
    expect(result.overall).toBe("allow");
    expect(result.ruleResults[0].reason).toBe("Target mismatch");
  });

  it("deny takes precedence over require-human-review", () => {
    const policy = {
      id: "policy-1",
      tenantId: "tenant-1",
      name: "Precedence Test",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "content-filter",
          target: { kind: "global" },
          condition: { kind: "regex", pattern: "bad" },
          action: "require-human-review",
          severity: "flag",
        },
        {
          id: "rule-2",
          type: "content-filter",
          target: { kind: "global" },
          condition: { kind: "regex", pattern: "bad" },
          action: "deny",
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin",
      status: "active",
    };
    const ctx = baseContext({ promptText: "This is bad content" });
    const result = evaluatePolicy(policy, ctx);
    expect(result.overall).toBe("deny");
    expect(result.matchedRules).toHaveLength(2);
  });
});
