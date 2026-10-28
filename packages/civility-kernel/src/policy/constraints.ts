
import { z } from "zod";
import { Plan, PreferencePolicy, ConstraintId, ConstraintSpec } from "./types.js";

export interface ConstraintResult {
  ok: boolean;
  id: ConstraintId;
  reason?: string;
  params?: Record<string, unknown>;
}

export type ConstraintHandler = {
  schema?: z.ZodTypeAny;
  describe?: (params?: Record<string, unknown>) => string;
  evaluate: (
    spec: { id: ConstraintId; params?: Record<string, unknown> },
    plan: Plan,
    policy: PreferencePolicy
  ) => ConstraintResult;
  evaluateAsync?: (
    spec: { id: ConstraintId; params?: Record<string, unknown> },
    plan: Plan,
    policy: PreferencePolicy
  ) => Promise<ConstraintResult>;
};

function normalize(spec: ConstraintSpec): { id: ConstraintId; params?: Record<string, unknown> } {
  return typeof spec === "string" ? { id: spec } : { id: spec.id, params: spec.params };
}

export class ConstraintRegistry {
  private handlers = new Map<ConstraintId, ConstraintHandler>();


  register(id: ConstraintId, handler: ConstraintHandler) {
    this.handlers.set(id, handler);
  }

  /**
   * Returns the handler for a given constraint id, or undefined if not registered.
   */
  public getHandler(id: string): ConstraintHandler | undefined {
    return this.handlers.get(id);
  }

  evaluateAsync(specs: ConstraintSpec[], plan: Plan, policy: PreferencePolicy): Promise<ConstraintResult[]> {
    return Promise.all(specs.map((raw) => {
      const spec = normalize(raw);
      const handler = this.handlers.get(spec.id);
      if (!handler) {
        return Promise.resolve({ ok: false, id: spec.id, params: spec.params, reason: "Unknown constraint (fail-closed)" });
      }
      if (handler.schema) {
        const parsed = handler.schema.safeParse(spec.params ?? {});
        if (!parsed.success) {
          return Promise.resolve({
            ok: false,
            id: spec.id,
            params: spec.params,
            reason: `Invalid params: ${parsed.error.issues.map((i: any) => i.message).join("; ")}`
          });
        }
        const evalSpec = { id: spec.id, params: parsed.data as Record<string, unknown> };
        if (handler.evaluateAsync) {
          return handler.evaluateAsync(evalSpec, plan, policy);
        }
        return Promise.resolve(handler.evaluate(evalSpec, plan, policy));
      }
      const evalSpec = spec.params === undefined || spec.params === null
        ? { id: spec.id, params: {} }
        : spec;
      if (handler.evaluateAsync) {
        return handler.evaluateAsync(evalSpec, plan, policy);
      }
      return Promise.resolve(handler.evaluate(evalSpec, plan, policy));
    }));
  }

  evaluate(specs: ConstraintSpec[], plan: Plan, policy: PreferencePolicy): ConstraintResult[] {
    return specs.map((raw) => {
      const spec = normalize(raw);
      const handler = this.handlers.get(spec.id);
      if (!handler) {
        return { ok: false, id: spec.id, params: spec.params, reason: "Unknown constraint (fail-closed)" };
      }
      if (handler.schema) {
        const parsed = handler.schema.safeParse(spec.params ?? {});
        if (!parsed.success) {
          return {
            ok: false,
            id: spec.id,
            params: spec.params,
            reason: `Invalid params: ${parsed.error.issues.map((i: any) => i.message).join("; ")}`
          };
        }
        return handler.evaluate({ id: spec.id, params: parsed.data as Record<string, unknown> }, plan, policy);
      }
      if (spec.params === undefined || spec.params === null) {
        return handler.evaluate({ id: spec.id, params: {} }, plan, policy);
      }
      return handler.evaluate(spec, plan, policy);
    });
  }
}

export function registerDefaultConstraints(reg: ConstraintRegistry) {
  reg.register("no_irreversible_changes", {
    describe: () => "No irreversible changes allowed",
    evaluate: (spec, plan) => {
      if (plan.meta.reversibility === 0) {
        return { ok: false, id: spec.id, params: spec.params, reason: "Plan includes irreversible action" };
      }
      return { ok: true, id: spec.id, params: spec.params };
    }
  });

  reg.register("max_spend_without_confirm", {
    schema: z.object({
      amount: z.number().nonnegative(),
      currency: z.string().optional()
    }),
    describe: (params) => {
      const p = params as any;
      return `Max spend without confirmation: ${p?.amount ?? 0} ${p?.currency ?? ""}`.trim();
    },
    evaluate: (spec, plan) => {
      const { amount } = spec.params as any;
      const spend = Number((plan.meta as any)?.estimatedCost ?? 0);
      const hasSpend = (plan.meta.tags ?? []).includes("spend_money");
      if (hasSpend && spend > amount) {
        return {
          ok: false,
          id: spec.id,
          params: spec.params,
          reason: `Spending ${spend} exceeds limit ${amount} without confirmation`
        };
      }
      return { ok: true, id: spec.id, params: spec.params };
    }
  });

  reg.register("require_confirm_if", {
    schema: z.object({
      stakeGte: z.number().min(0).max(1),
      irreversible: z.boolean().default(false)
    }),
    describe: (params) => {
      const p = params as any;
      const parts = [`stake >= ${p?.stakeGte ?? 0}`];
      if (p?.irreversible) parts.push("is irreversible");
      return `Require confirmation if ${parts.join(" and ")}`;
    },
    evaluate: (spec, plan) => {
      const { stakeGte, irreversible = false } = spec.params as any;
      const stake = plan.meta.stake ?? 0;
      const isIrrev = plan.meta.reversibility === 0;
      const triggers = stake >= stakeGte && (!irreversible || isIrrev);
      if (triggers) {
        return {
          ok: false,
          id: spec.id,
          params: spec.params,
          reason: "Requires explicit confirmation in this context"
        };
      }
      return { ok: true, id: spec.id, params: spec.params };
    }
  });
}
