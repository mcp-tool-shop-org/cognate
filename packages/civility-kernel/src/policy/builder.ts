import { PreferencePolicy, ConstraintSpec } from "./types.js";
import { loadPolicy } from "./persistence.js";

type ContextRule = PreferencePolicy["contextRules"][number];

export class PolicyBuilder {
  private _version = "1.0";
  private _weights: Record<string, number> = {};
  private _constraints: ConstraintSpec[] = [];
  private _uncertaintyThreshold = 0.5;
  private _calibration = { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 };
  private _memory: Record<string, unknown> = {};
  private _contextRules: ContextRule[] = [];

  setVersion(v: string): this {
    this._version = v;
    return this;
  }

  setWeight(key: string, value: number): this {
    this._weights[key] = value;
    return this;
  }

  addConstraint(spec: ConstraintSpec): this {
    this._constraints.push(spec);
    return this;
  }

  setUncertaintyThreshold(n: number): this {
    this._uncertaintyThreshold = n;
    return this;
  }

  setCalibration(partial: Partial<{ riskTolerance: number; verbosity: number; initiative: number }>): this {
    this._calibration = { ...this._calibration, ...partial };
    return this;
  }

  addContextRule(rule: ContextRule): this {
    this._contextRules.push(rule);
    return this;
  }

  build(): PreferencePolicy {
    const raw = {
      version: this._version,
      weights: { ...this._weights },
      constraints: [...this._constraints],
      contextRules: [...this._contextRules],
      uncertaintyThreshold: this._uncertaintyThreshold,
      memory: { ...this._memory },
      calibration: { ...this._calibration },
    };
    // Validate via Zod schema
    return loadPolicy(raw);
  }
}
