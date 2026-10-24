/**
 * POST /registry/versions/:id/evaluations — request parsing for recording an evaluation on a version.
 *
 * The server appends the evaluation through `attestEvaluation`; this module only checks the request, so the route
 * refuses a body that names a different version or tenant than the path and the caller.
 */

import type { RequireEvaluationCitations } from "@cognate/model-registry";
import type { Evaluation } from "@cognate/types";

/**
 * The transition citation rule from `COGNATE_REQUIRE_EVALUATION_CITATIONS`: unset or "false" is `false` (no
 * citations required), "decisions" or "all" as named. Any other value throws, so a typo can't silently relax the rule.
 */
export function citationRuleFromEnv(env: Record<string, string | undefined>): RequireEvaluationCitations {
  const raw = env.COGNATE_REQUIRE_EVALUATION_CITATIONS?.trim();
  if (raw === undefined || raw === "" || raw === "false") return false;
  if (raw === "decisions" || raw === "all") return raw;
  throw new Error(
    `COGNATE_REQUIRE_EVALUATION_CITATIONS must be false, decisions or all, not "${raw}". The server did not start.`,
  );
}

export const EVALUATIONS_PATH = /^\/registry\/versions\/([^/]+)\/evaluations$/;

export type EvaluationRequest =
  | { ok: true; evaluation: Evaluation }
  | { ok: false; error: { code: string; message: string; hint: string } };

export function parseEvaluationRequest(body: unknown, versionId: string, tenantId: string): EvaluationRequest {
  const evaluation = (body as { evaluation?: Evaluation } | null)?.evaluation;
  if (!evaluation || typeof evaluation !== "object" || typeof evaluation.id !== "string" || !Array.isArray(evaluation.metrics)) {
    return {
      ok: false,
      error: {
        code: "registry.missing-evaluation",
        message: "Missing evaluation",
        hint: "Provide an evaluation object with id, modelVersionId, tenantId, evaluator, evaluatedAt, metrics, overall and notes.",
      },
    };
  }
  if (evaluation.modelVersionId !== versionId) {
    return {
      ok: false,
      error: {
        code: "registry.evaluation-version-mismatch",
        message: `The evaluation names version "${evaluation.modelVersionId}", but the path names "${versionId}".`,
        hint: "Post the evaluation to its own version's path.",
      },
    };
  }
  if (evaluation.tenantId !== tenantId) {
    return {
      ok: false,
      error: {
        code: "registry.evaluation-tenant-mismatch",
        message: "The evaluation names a different tenant than the caller.",
        hint: "Record evaluations under your own tenant.",
      },
    };
  }
  return { ok: true, evaluation };
}
