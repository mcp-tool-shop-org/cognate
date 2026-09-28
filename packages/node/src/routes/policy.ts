import type { ServerResponse } from "http";
import { evaluatePolicy } from "@cognate/policy";
import type { Policy } from "@cognate/types";
import type { EvaluationContext } from "@cognate/policy";


export async function handlePolicy(res: ServerResponse, body: unknown): Promise<void> {
  const req = body as { policy?: Policy; context?: EvaluationContext };
  if (!req.policy || !req.context) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing policy or context" }));
    return;
  }
  const result = evaluatePolicy(req.policy, req.context);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}
