import { describe, expect, it } from "vitest";
import { evaluatePolicy, hasCapability, isCapabilityActive } from "../src/evaluator.js";
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


  it('handles invalid regex gracefully', () => {
    const policy = {
      id: "policy-1",
      tenantId: "tenant-1",
      name: "Invalid Regex",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "content-filter",
          target: { kind: "global" },
          condition: { kind: "regex", pattern: "[invalid" },
          action: "deny",
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin",
      status: "active",
    };
    const result = evaluatePolicy(policy, baseContext({ promptText: "anything" }));
    expect(result.overall).toBe("allow");
    expect(result.ruleResults[0].reason).toContain("Invalid regex");
  });

  it('handles missing metric in threshold', () => {
    const policy = {
      id: "policy-1",
      tenantId: "tenant-1",
      name: "Missing Metric",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "threshold",
          target: { kind: "global" },
          condition: { kind: "threshold", metric: "unknownMetric", operator: "gt", value: 100 },
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
    expect(result.ruleResults[0].reason).toContain("unavailable");
  });

  it('evaluates all threshold operators', () => {
    const ops = [
      { operator: "lt", value: 200, metadata: { latencyMs: 150 }, expected: true },
      { operator: "lte", value: 150, metadata: { latencyMs: 150 }, expected: true },
      { operator: "gt", value: 100, metadata: { latencyMs: 150 }, expected: true },
      { operator: "gte", value: 150, metadata: { latencyMs: 150 }, expected: true },
      { operator: "eq", value: 150, metadata: { latencyMs: 150 }, expected: true },
    ];
    for (const op of ops) {
      const policy = {
        id: "policy-1",
        tenantId: "tenant-1",
        name: "Threshold",
        version: 1,
        rules: [
          {
            id: "rule-1",
            type: "guardrail",
            target: { kind: "global" },
            condition: { kind: "threshold", metric: "latencyMs", operator: op.operator, value: op.value },
            action: "deny",
            severity: "block",
          },
        ],
        createdAt: now,
        approvedBy: "admin",
        status: "active",
      };
      const ctx = baseContext({ metadata: { ...baseContext().metadata, ...op.metadata } });
      const result = evaluatePolicy(policy, ctx);
      expect(result.overall).toBe(op.expected ? "deny" : "allow");
    }
  });

  it('evaluates threshold operators that do not match', () => {
    const ops = [
      { operator: "lt", value: 100, metadata: { latencyMs: 150 } },
      { operator: "lte", value: 100, metadata: { latencyMs: 150 } },
      { operator: "gt", value: 200, metadata: { latencyMs: 150 } },
      { operator: "gte", value: 200, metadata: { latencyMs: 150 } },
      { operator: "eq", value: 100, metadata: { latencyMs: 150 } },
    ];
    for (const op of ops) {
      const policy = {
        id: "policy-1",
        tenantId: "tenant-1",
        name: "Threshold",
        version: 1,
        rules: [
          {
            id: "rule-1",
            type: "guardrail",
            target: { kind: "global" },
            condition: { kind: "threshold", metric: "latencyMs", operator: op.operator, value: op.value },
            action: "deny",
            severity: "block",
          },
        ],
        createdAt: now,
        approvedBy: "admin",
        status: "active",
      };
      const ctx = baseContext({ metadata: { ...baseContext().metadata, ...op.metadata } });
      const result = evaluatePolicy(policy, ctx);
      expect(result.overall).toBe("allow");
    }
  });

  it('matches model target', () => {
    const policy = {
      id: "policy-1",
      tenantId: "tenant-1",
      name: "Model Target",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "content-filter",
          target: { kind: "model", modelId: "model-v1" },
          condition: { kind: "regex", pattern: ".*" },
          action: "deny",
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin",
      status: "active",
    };
    const result = evaluatePolicy(policy, baseContext({ modelVersionId: "model-v1" }));
    expect(result.overall).toBe("deny");
  });

  it('does not match model target for different model', () => {
    const policy = {
      id: "policy-1",
      tenantId: "tenant-1",
      name: "Model Target",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "content-filter",
          target: { kind: "model", modelId: "model-v2" },
          condition: { kind: "regex", pattern: ".*" },
          action: "deny",
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin",
      status: "active",
    };
    const result = evaluatePolicy(policy, baseContext({ modelVersionId: "model-v1" }));
    expect(result.overall).toBe("allow");
    expect(result.ruleResults[0].reason).toBe("Target mismatch");
  });

  it('matches agent target', () => {
    const policy = {
      id: "policy-1",
      tenantId: "tenant-1",
      name: "Agent Target",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "content-filter",
          target: { kind: "agent", agentId: "agent-1" },
          condition: { kind: "regex", pattern: ".*" },
          action: "deny",
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin",
      status: "active",
    };
    const result = evaluatePolicy(policy, baseContext({ agentId: "agent-1" }));
    expect(result.overall).toBe("deny");
  });

  it('quarantine action takes precedence over require-human-review', () => {
    const policy = {
      id: "policy-1",
      tenantId: "tenant-1",
      name: "Quarantine Precedence",
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
          action: "quarantine",
          severity: "flag",
        },
      ],
      createdAt: now,
      approvedBy: "admin",
      status: "active",
    };
    const ctx = baseContext({ promptText: "This is bad content" });
    const result = evaluatePolicy(policy, ctx);
    expect(result.overall).toBe("quarantine");
  });


  it('hasCapability returns true when capability exists', () => {
    // using imported hasCapability
    const caps = [{ kind: 'inference' }, { kind: 'spend' }];
    expect(hasCapability(caps, 'inference')).toBe(true);
    expect(hasCapability(caps, 'deploy-model')).toBe(false);
  });

  it('isCapabilityActive checks expiry', () => {
    // using imported isCapabilityActive
    const active = { expiresAt: null };
    expect(isCapabilityActive(active, '2026-09-28T12:00:00Z')).toBe(true);
    const expired = { expiresAt: '2026-09-27T12:00:00Z' };
    expect(isCapabilityActive(expired, '2026-09-28T12:00:00Z')).toBe(false);
    const future = { expiresAt: '2026-09-29T12:00:00Z' };
    expect(isCapabilityActive(future, '2026-09-28T12:00:00Z')).toBe(true);
  });

  it('composite-and returns false when first condition fails', () => {
    const policy = {
      id: 'policy-1',
      tenantId: 'tenant-1',
      name: 'AND First Fails',
      version: 1,
      rules: [
        {
          id: 'rule-1',
          type: 'composite',
          target: { kind: 'global' },
          condition: {
            kind: 'composite-and',
            conditions: [
              { kind: 'keyword', words: ['nonexistent'] },
              { kind: 'keyword', words: ['hello'] },
            ],
          },
          action: 'deny',
          severity: 'block',
        },
      ],
      createdAt: now,
      approvedBy: 'admin',
      status: 'active',
    };
    const result = evaluatePolicy(policy, baseContext({ promptText: 'hello world' }));
    expect(result.overall).toBe('allow');
  });

  it('composite-or returns false when no condition matches', () => {
    const policy = {
      id: 'policy-1',
      tenantId: 'tenant-1',
      name: 'OR None Match',
      version: 1,
      rules: [
        {
          id: 'rule-1',
          type: 'composite',
          target: { kind: 'global' },
          condition: {
            kind: 'composite-or',
            conditions: [
              { kind: 'keyword', words: ['alpha'] },
              { kind: 'keyword', words: ['beta'] },
            ],
          },
          action: 'deny',
          severity: 'block',
        },
      ],
      createdAt: now,
      approvedBy: 'admin',
      status: 'active',
    };
    const result = evaluatePolicy(policy, baseContext({ promptText: 'gamma delta' }));
    expect(result.overall).toBe('allow');
  });

  it('model target mismatch when modelVersionId is null', () => {
    const policy = {
      id: 'policy-1',
      tenantId: 'tenant-1',
      name: 'Model Null',
      version: 1,
      rules: [
        {
          id: 'rule-1',
          type: 'content-filter',
          target: { kind: 'model', modelId: 'model-v1' },
          condition: { kind: 'regex', pattern: '.*' },
          action: 'deny',
          severity: 'block',
        },
      ],
      createdAt: now,
      approvedBy: 'admin',
      status: 'active',
    };
    const result = evaluatePolicy(policy, baseContext({ modelVersionId: null }));
    expect(result.overall).toBe('allow');
    expect(result.ruleResults[0].reason).toBe('Target mismatch');
  });

  it('agent target mismatch when agentId is null', () => {
    const policy = {
      id: 'policy-1',
      tenantId: 'tenant-1',
      name: 'Agent Null',
      version: 1,
      rules: [
        {
          id: 'rule-1',
          type: 'content-filter',
          target: { kind: 'agent', agentId: 'agent-1' },
          condition: { kind: 'regex', pattern: '.*' },
          action: 'deny',
          severity: 'block',
        },
      ],
      createdAt: now,
      approvedBy: 'admin',
      status: 'active',
    };
    const result = evaluatePolicy(policy, baseContext({ agentId: null }));
    expect(result.overall).toBe('allow');
    expect(result.ruleResults[0].reason).toBe('Target mismatch');
  });
});

describe("regex conditions with untrusted patterns", () => {
  function regexPolicy(pattern: string, action = "deny", condition?: object): Policy {
    return {
      id: "policy-1",
      tenantId: "tenant-1",
      name: "Regex Bounds",
      version: 1,
      rules: [
        {
          id: "rule-1",
          type: "content-filter",
          target: { kind: "global" },
          condition: condition ?? { kind: "regex", pattern },
          action,
          severity: "block",
        },
      ],
      createdAt: now,
      approvedBy: "admin",
      status: "active",
    } as unknown as Policy;
  }

  function run(pattern: string, promptText: string) {
    const start = performance.now();
    const result = evaluatePolicy(regexPolicy(pattern), baseContext({ promptText }));
    return { result, ms: performance.now() - start, reason: result.ruleResults[0].reason };
  }

  const longMiss = "a".repeat(50) + "b";

  it.each(["(a+)+$", "(a*)*$", "((ab)+)+c", "(?:x+x+)+y"])(
    "rejects nested repetition %s without running it",
    (pattern) => {
      const { result, ms, reason } = run(pattern, longMiss);
      expect(ms).toBeLessThan(500);
      expect(result.overall).toBe("allow");
      expect(reason).toContain("Regex rejected");
    }
  );

  it("rejects backreferences", () => {
    const { result, reason } = run("(a+)\\1$", longMiss);
    expect(result.overall).toBe("allow");
    expect(reason).toContain("backreferences");
  });

  it("stops a repeated alternation with overlapping branches within the time limit, and denies", () => {
    const { result, ms, reason } = run("(a|aa)+$", longMiss);
    expect(ms).toBeLessThan(1000);
    expect(result.overall).toBe("deny");
    expect(reason).toContain("regex timed out");
    expect(result.ruleResults[0].timedOut).toBe(true);
  });

  it("stops a polynomial pattern the static check lets through, and denies", () => {
    const { result, ms, reason } = run(".*.*.*.*x", "a".repeat(50_000));
    expect(ms).toBeLessThan(1000);
    expect(result.overall).toBe("deny");
    expect(reason).toContain("regex timed out");
  });

  it("denies when a long text makes a legitimate deny rule's pattern time out", () => {
    // The author wrote a valid pattern; only the text is hostile. "No match" here would walk the text past the rule.
    const { result } = run(".*.*.*.*x", "a".repeat(50_000));
    expect(result.matchedRules).toHaveLength(0);
    expect(result.overall).toBe("deny");
  });

  it("denies when a rule with a non-deny action times out", () => {
    const policy = regexPolicy(".*.*.*.*x", "allow");
    const result = evaluatePolicy(policy, baseContext({ promptText: "a".repeat(50_000) }));
    expect(result.overall).toBe("deny");
    expect(result.ruleResults[0].reason).toContain("regex timed out");
  });

  it("denies when a timeout sits inside AND or OR, whether or not the rest matches", () => {
    const slow = { kind: "regex", pattern: ".*.*.*.*x" };
    const hit = { kind: "keyword", words: ["aaa"] };
    for (const condition of [
      { kind: "composite-and", conditions: [slow, hit] },
      { kind: "composite-or", conditions: [slow, hit] },
      { kind: "composite-and", conditions: [hit, slow] },
    ]) {
      const result = evaluatePolicy(regexPolicy("unused", "allow", condition), baseContext({ promptText: "a".repeat(50_000) }));
      expect(result.overall).toBe("deny");
    }
  });

  it("does not deny for a rejected pattern, which is the author's own mistake", () => {
    const { result } = run("(a+)+$", longMiss);
    expect(result.overall).toBe("allow");
    expect(result.ruleResults[0].timedOut).toBeUndefined();
  });

  it("rejects an oversized pattern", () => {
    const { result, reason } = run("a".repeat(1_001), "a");
    expect(result.overall).toBe("allow");
    expect(reason).toContain("pattern longer than");
  });

  it("still evaluates long text, so padding a prompt cannot get past a rule", () => {
    const { result } = run("needle", "x".repeat(200_000) + "needle");
    expect(result.overall).toBe("deny");
  });

  it("still reports an invalid pattern as invalid", () => {
    const { reason } = run("[invalid", "anything");
    expect(reason).toContain("Invalid regex");
  });

  it.each([
    ["investment advice", "Please give me INVESTMENT ADVICE now", true],
    [".*", "anything", true],
    ["^bad$", "bad", true],
    ["\\d{3}-\\d{4}", "call 555-1234", true],
    ["(?:ssn|social security)\\s+number", "my Social Security number is", true],
    ["(ab)+c", "xababc", true],
    ["colou?r", "what colour", true],
    ["(foo|bar)+baz", "xfoobarbaz", true],
    ["(?:foo|bar)+", "a bar", true],
    ["[a-z]+@[a-z]+\\.com", "mail bob@example.com", true],
    ["investment advice", "nothing relevant", false],
  ])("keeps ordinary pattern %s working", (pattern, text, expected) => {
    const { result } = run(pattern, text);
    expect(result.overall).toBe(expected ? "deny" : "allow");
  });
});
