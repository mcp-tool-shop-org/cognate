import { Plan } from "./types.js";

export function extractTags(plan: Plan): string[] {
  const tags = new Set<string>();
  for (const step of plan.steps) {
    const detail = step.detail.toLowerCase();
    if (/spend|purchase|buy|pay/.test(detail)) tags.add("spend_money");
    if (/irreversible|cannot undo|permanent/.test(detail)) tags.add("irreversible");
    if (/email|message|contact/.test(detail)) tags.add("contact_external");
    if (/delete|remove|erase/.test(detail)) tags.add("delete_file");
  }
  return Array.from(tags);
}

export function annotatePlanWithTags(plan: Plan): Plan {
  return {
    ...plan,
    meta: {
      ...plan.meta,
      tags: Array.from(new Set([...(plan.meta.tags ?? []), ...extractTags(plan)])),
    },
  };
}
