import { Plan, PreferencePolicy, WeightKey } from "./types.js";

export type ScorerFn = (plan: Plan, policy: PreferencePolicy) => number;

export class ScorerRegistry {
  private scorers = new Map<WeightKey, ScorerFn>();

  register(key: WeightKey, fn: ScorerFn) {
    this.scorers.set(key, fn);
  }

  has(key: WeightKey): boolean {
    return this.scorers.has(key);
  }

  score(plan: Plan, policy: PreferencePolicy): Record<WeightKey, number> {
    const out: Record<string, number> = {};
    for (const [k] of Object.entries(policy.weights)) {
      const fn = this.scorers.get(k);
      out[k] = fn ? clamp01(fn(plan, policy)) : 0;
    }
    return out;
  }
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function registerDefaultScorers(reg: ScorerRegistry) {
  reg.register("efficiency", (plan) => {
    const t = plan.meta.estimatedTimeSec ?? 60;
    return 1 / (1 + t / 60);
  });
  reg.register("low_risk", (plan, policy) => {
    const stake = plan.meta.stake ?? 0.5;
    const riskTol = policy.calibration.riskTolerance;
    return clamp01(1 - stake * (1 - riskTol));
  });
  reg.register("concise", (_plan, policy) => {
    return policy.calibration.verbosity < 0.5 ? 1 : 0.5;
  });
}
