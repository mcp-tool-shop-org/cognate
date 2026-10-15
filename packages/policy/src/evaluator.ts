/**
 * Policy Evaluation Engine — pure functions, no side effects.
 *
 * Evaluates PolicyRules against an EvaluationContext using pure predicates.
 * All state needed for evaluation must be provided in the context.
 */

import { Script, createContext } from "node:vm";
import type {
  Capability,
  CapabilityKind,
  Policy,
  PolicyCondition,
  PolicyRule,
  PolicyTarget,
} from "@cognate/types";
import type { EvaluationContext, PolicyResult, RuleResult } from "./types.js";

// ─── Public API ───

/**
 * Evaluate a policy against a context.
 *
 * Pure function: same inputs → same outputs. No I/O, no mutation, no clock access.
 * The caller must supply the current timestamp via `context.timestamp`.
 */
export function evaluatePolicy(
  policy: Policy,
  context: EvaluationContext
): PolicyResult {
  const ruleResults: RuleResult[] = policy.rules.map((rule) =>
    evaluateRule(rule, context)
  );

  const matchedRules = ruleResults.filter((r) => r.matched);
  const blockingRules = matchedRules.filter((r) => r.severity === "block");

  // Deterministic overall action: highest-precedence action wins
  // precedence: deny > quarantine > require-human-review > allow
  // A regex that ran out of time fails closed: whoever controls only the text can make
  // a legitimate pattern time out, and "no match" would let that text past a deny rule.
  const overall = ruleResults.some((r) => r.timedOut)
    ? "deny"
    : resolveOverallAction(matchedRules);

  return {
    policyId: policy.id,
    policyVersion: policy.version,
    evaluatedAt: context.timestamp,
    overall,
    ruleResults,
    matchedRules,
    blockingRules,
  };
}

// ─── Rule Evaluation ───

function evaluateRule(rule: PolicyRule, context: EvaluationContext): RuleResult {
  // Target check: rule only applies if target matches context
  const targetMatches = evaluateTarget(rule.target, context);
  if (!targetMatches) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      matched: false,
      severity: rule.severity,
      action: rule.action,
      reason: "Target mismatch",
    };
  }

  // Condition evaluation
  const conditionResult = evaluateCondition(rule.condition, context);

  return {
    ruleId: rule.id,
    ruleType: rule.type,
    matched: conditionResult.matched,
    severity: rule.severity,
    action: rule.action,
    reason: conditionResult.reason,
    ...(conditionResult.timedOut ? { timedOut: true } : {}),
  };
}

// ─── Target Matching ───

function evaluateTarget(target: PolicyTarget, context: EvaluationContext): boolean {
  switch (target.kind) {
    case "global":
      return true;
    case "tenant":
      return target.tenantId === context.tenantId;
    case "model":
      return context.modelVersionId !== null && target.modelId === context.modelVersionId;
    case "agent":
      return context.agentId !== null && target.agentId === context.agentId;
    default:
      return false;
  }
}

// ─── Condition Evaluation ───

interface ConditionResult {
  readonly matched: boolean;
  readonly reason: string;
  /** A regex in this condition was stopped by the time limit. */
  readonly timedOut?: boolean;
}

function evaluateCondition(
  condition: PolicyCondition,
  context: EvaluationContext
): ConditionResult {
  switch (condition.kind) {
    case "regex":
      return evaluateRegex(condition.pattern, context);
    case "keyword":
      return evaluateKeyword(condition.words, context);
    case "threshold":
      return evaluateThreshold(condition.metric, condition.operator, condition.value, context);
    case "composite-and":
      return evaluateCompositeAnd(condition.conditions, context);
    case "composite-or":
      return evaluateCompositeOr(condition.conditions, context);
    default:
      return { matched: false, reason: "Unknown condition kind" };
  }
}

// Policies arrive in request bodies, so the pattern is attacker-controlled. Three
// bounds apply, cheapest first: a length cap on the pattern, a static rejection of
// shapes that backtrack exponentially, and a wall-clock limit for the polynomial
// shapes the static check cannot rule out (`.*.*.*x`). The last needs vm: a plain
// RegExp.test cannot be interrupted. The text is not capped: a rule that stopped
// matching long input would let anyone pad a prompt past a deny rule.
const MAX_REGEX_PATTERN_LENGTH = 1_000;
const REGEX_TIMEOUT_MS = 100;

const regexSandbox: { re: RegExp | null; text: string } = { re: null, text: "" };
createContext(regexSandbox);
const regexScript = new Script("re.test(text)");

/**
 * Cheap check for the common shapes that backtrack catastrophically:
 * backreferences, and a group that is itself repeated while containing a
 * repetition, such as `(a+)+` or `((ab)+)*`. A repeated alternation such as
 * `(foo|bar)+` is allowed, because most are harmless; one whose branches
 * overlap (`(a|aa)+`) is left to the time limit.
 */
function unsafeRegexReason(pattern: string): string | null {
  // One frame per open group, plus the root; `carrier` is true once the group
  // holds a repetition.
  const frames: { carrier: boolean }[] = [{ carrier: false }];
  // Set when the previous token closed a group: whether that group is a carrier.
  let closed: boolean | null = null;
  let inClass = false;

  // The closed group was not repeated, so it is just an atom of its parent.
  const flush = () => {
    if (closed === true) frames[frames.length - 1].carrier = true;
    closed = null;
  };

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];

    if (c === "\\") {
      flush();
      const next = pattern[i + 1] ?? "";
      if (!inClass && (/[1-9]/.test(next) || (next === "k" && pattern[i + 2] === "<"))) {
        return "backreferences are not allowed";
      }
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }

    let repeats = false;
    let quantifier = false;
    if (c === "*" || c === "+") {
      quantifier = repeats = true;
    } else if (c === "?") {
      quantifier = true;
    } else if (c === "{") {
      const m = /^\{(\d+)(?:,(\d*))?\}/.exec(pattern.slice(i));
      if (m) {
        quantifier = true;
        repeats = m[2] === "" || Number(m[2] ?? m[1]) > 1;
        i += m[0].length - 1;
      }
    }

    if (quantifier) {
      if (repeats) {
        if (closed === true) return "nested repetition can backtrack catastrophically";
        closed = null;
        frames[frames.length - 1].carrier = true;
      } else {
        flush();
      }
      continue;
    }

    flush();
    if (c === "[") {
      inClass = true;
    } else if (c === "(") {
      frames.push({ carrier: false });
    } else if (c === ")" && frames.length > 1) {
      closed = frames.pop()!.carrier;
    }
  }
  return null;
}

function evaluateRegex(pattern: string, context: EvaluationContext): ConditionResult {
  const text = context.promptText ?? context.outputText ?? "";
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "i"); // case-insensitive
  } catch {
    return { matched: false, reason: `Invalid regex: /${pattern}/` };
  }

  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    return { matched: false, reason: `Regex rejected: pattern longer than ${MAX_REGEX_PATTERN_LENGTH} characters` };
  }
  const unsafe = unsafeRegexReason(pattern);
  if (unsafe !== null) {
    return { matched: false, reason: `Regex rejected: ${unsafe}: /${pattern}/` };
  }

  let matched: boolean;
  try {
    regexSandbox.re = regex;
    regexSandbox.text = text;
    matched = regexScript.runInContext(regexSandbox, { timeout: REGEX_TIMEOUT_MS }) as boolean;
  } catch {
    return { matched: false, timedOut: true, reason: `regex timed out: evaluation exceeded ${REGEX_TIMEOUT_MS} ms: /${pattern}/` };
  } finally {
    regexSandbox.re = null;
    regexSandbox.text = "";
  }
  return {
    matched,
    reason: matched ? `Regex matched: /${pattern}/i` : `Regex did not match: /${pattern}/i`,
  };
}

function evaluateKeyword(
  words: readonly string[],
  context: EvaluationContext
): ConditionResult {
  const text = (context.promptText ?? context.outputText ?? "").toLowerCase();
  const matchedWords = words.filter((w) => text.includes(w.toLowerCase()));
  const matched = matchedWords.length > 0;
  return {
    matched,
    reason: matched
      ? `Keywords found: [${matchedWords.join(", ")}]`
      : `No keywords found in [${words.join(", ")}]`,
  };
}

function evaluateThreshold(
  metric: string,
  operator: "lt" | "lte" | "gt" | "gte" | "eq",
  value: number,
  context: EvaluationContext
): ConditionResult {
  const actual = extractMetric(metric, context);

  if (actual === null || Number.isNaN(actual)) {
    return { matched: false, reason: `Metric "${metric}" unavailable` };
  }

  const matched = applyOperator(actual, operator, value);
  return {
    matched,
    reason: matched
      ? `${metric} = ${actual} ${operator} ${value}`
      : `${metric} = ${actual} NOT ${operator} ${value}`,
  };
}

function extractMetric(metric: string, context: EvaluationContext): number | null {
  switch (metric) {
    case "tokensIn":
      return context.metadata.tokensIn;
    case "tokensOut":
      return context.metadata.tokensOut;
    case "latencyMs":
      return context.metadata.latencyMs;
    case "confidence":
      return context.metadata.confidence;
    case "callsInWindow":
      return context.counters.callsInWindow;
    case "spendInWindow":
      return context.counters.spendInWindow;
    default:
      return null;
  }
}

function applyOperator(
  actual: number,
  operator: "lt" | "lte" | "gt" | "gte" | "eq",
  threshold: number
): boolean {
  switch (operator) {
    case "lt":
      return actual < threshold;
    case "lte":
      return actual <= threshold;
    case "gt":
      return actual > threshold;
    case "gte":
      return actual >= threshold;
    case "eq":
      return actual === threshold;
    default:
      return false;
  }
}

function evaluateCompositeAnd(
  conditions: readonly PolicyCondition[],
  context: EvaluationContext
): ConditionResult {
  for (const cond of conditions) {
    const result = evaluateCondition(cond, context);
    if (!result.matched) {
      return { matched: false, reason: `AND failed: ${result.reason}`, ...(result.timedOut ? { timedOut: true } : {}) };
    }
  }
  return { matched: true, reason: "All AND conditions matched" };
}

function evaluateCompositeOr(
  conditions: readonly PolicyCondition[],
  context: EvaluationContext
): ConditionResult {
  let timedOut = false;
  for (const cond of conditions) {
    const result = evaluateCondition(cond, context);
    if (result.timedOut) timedOut = true;
    if (result.matched) {
      return { matched: true, reason: `OR matched: ${result.reason}`, ...(timedOut ? { timedOut: true } : {}) };
    }
  }
  return { matched: false, reason: "No OR condition matched", ...(timedOut ? { timedOut: true } : {}) };
}

// ─── Overall Action Resolution ───

/**
 * Resolve the overall action from matched rules.
 *
 * Precedence (highest wins):
 *   deny > quarantine > require-human-review > allow
 */
function resolveOverallAction(
  matchedRules: readonly RuleResult[]
): "allow" | "deny" | "require-human-review" | "quarantine" {
  if (matchedRules.length === 0) {
    return "allow";
  }

  const actions = matchedRules.map((r) => r.action);

  if (actions.includes("deny")) return "deny";
  if (actions.includes("quarantine")) return "quarantine";
  if (actions.includes("require-human-review")) return "require-human-review";
  return "allow";
}

// ─── Capability Check (utility) ───

/**
 * Check if an agent has a specific capability kind in its capability list.
 * Pure utility — callers supply the pre-resolved agent capabilities.
 */
export function hasCapability(
  capabilities: readonly Capability[],
  kind: CapabilityKind
): boolean {
  return capabilities.some((c) => c.kind === kind);
}

/**
 * Check if a capability is active at a given timestamp (pure).
 */
export function isCapabilityActive(
  capability: Capability,
  atTimestamp: string
): boolean {
  if (capability.expiresAt === null) return true;
  return atTimestamp < capability.expiresAt;
}
