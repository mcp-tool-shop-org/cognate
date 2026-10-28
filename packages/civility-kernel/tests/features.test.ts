import { describe, it, expect } from "vitest";
import { extractTags, annotatePlanWithTags } from "../src/policy/features.js";
import { Plan } from "../src/policy/types.js";

function makePlan(steps: Array<{ kind: string; detail: string }>): Plan {
  return {
    id: "test",
    summary: "Test plan",
    steps,
    meta: {},
  };
}

describe("extractTags", () => {
  it("detects spend_money from purchase/buy/pay keywords", () => {
    const plan = makePlan([{ kind: "action", detail: "Purchase the premium plan" }]);
    expect(extractTags(plan)).toContain("spend_money");

    const plan2 = makePlan([{ kind: "action", detail: "Buy a new license" }]);
    expect(extractTags(plan2)).toContain("spend_money");

    const plan3 = makePlan([{ kind: "action", detail: "Pay the invoice" }]);
    expect(extractTags(plan3)).toContain("spend_money");
  });

  it("detects irreversible from cannot undo/permanent keywords", () => {
    const plan = makePlan([{ kind: "action", detail: "This is irreversible" }]);
    expect(extractTags(plan)).toContain("irreversible");

    const plan2 = makePlan([{ kind: "action", detail: "Cannot undo this operation" }]);
    expect(extractTags(plan2)).toContain("irreversible");

    const plan3 = makePlan([{ kind: "action", detail: "Make a permanent change" }]);
    expect(extractTags(plan3)).toContain("irreversible");
  });

  it("detects contact_external from email/message/contact keywords", () => {
    const plan = makePlan([{ kind: "action", detail: "Email the team" }]);
    expect(extractTags(plan)).toContain("contact_external");

    const plan2 = makePlan([{ kind: "action", detail: "Send a message to the user" }]);
    expect(extractTags(plan2)).toContain("contact_external");
  });

  it("detects delete_file from delete/remove/erase keywords", () => {
    const plan = makePlan([{ kind: "action", detail: "Delete the old logs" }]);
    expect(extractTags(plan)).toContain("delete_file");

    const plan2 = makePlan([{ kind: "action", detail: "Remove the temp file" }]);
    expect(extractTags(plan2)).toContain("delete_file");

    const plan3 = makePlan([{ kind: "action", detail: "Erase the cache" }]);
    expect(extractTags(plan3)).toContain("delete_file");
  });

  it("detects multiple tags from a single step", () => {
    const plan = makePlan([
      { kind: "action", detail: "Buy the item and permanently delete the old one" },
    ]);
    const tags = extractTags(plan);
    expect(tags).toContain("spend_money");
    expect(tags).toContain("irreversible");
    expect(tags).toContain("delete_file");
  });

  it("detects tags across multiple steps", () => {
    const plan = makePlan([
      { kind: "action", detail: "Pay for the subscription" },
      { kind: "action", detail: "Email the receipt" },
    ]);
    const tags = extractTags(plan);
    expect(tags).toContain("spend_money");
    expect(tags).toContain("contact_external");
  });

  it("returns empty array when no keywords match", () => {
    const plan = makePlan([{ kind: "action", detail: "Read the documentation" }]);
    expect(extractTags(plan)).toEqual([]);
  });

  it("is case-insensitive", () => {
    const plan = makePlan([{ kind: "action", detail: "PURCHASE the PREMIUM plan" }]);
    expect(extractTags(plan)).toContain("spend_money");
  });

  it("does not produce duplicates across steps", () => {
    const plan = makePlan([
      { kind: "action", detail: "Buy item A" },
      { kind: "action", detail: "Purchase item B" },
    ]);
    const tags = extractTags(plan);
    const spendCount = tags.filter((t) => t === "spend_money").length;
    expect(spendCount).toBe(1);
  });
});

describe("annotatePlanWithTags", () => {
  it("returns a new plan with tags populated in meta", () => {
    const plan = makePlan([{ kind: "action", detail: "Delete the backup" }]);
    const annotated = annotatePlanWithTags(plan);
    expect(annotated.meta.tags).toContain("delete_file");
    expect(annotated).not.toBe(plan); // immutable — new object
  });

  it("does not mutate the original plan", () => {
    const plan = makePlan([{ kind: "action", detail: "Buy a thing" }]);
    const original = { ...plan, meta: { ...plan.meta } };
    annotatePlanWithTags(plan);
    expect(plan.meta.tags).toBeUndefined();
    expect(plan).toEqual(original);
  });

  it("merges existing tags with extracted tags without duplicates", () => {
    const plan: Plan = {
      id: "test",
      summary: "Test plan",
      steps: [{ kind: "action", detail: "Delete the backup and buy a license" }],
      meta: { tags: ["delete_file", "custom_tag"] },
    };
    const annotated = annotatePlanWithTags(plan);
    // Should have existing + new extracted, no duplicates
    expect(annotated.meta.tags).toContain("delete_file");
    expect(annotated.meta.tags).toContain("custom_tag");
    expect(annotated.meta.tags).toContain("spend_money");
    const deleteCount = annotated.meta.tags!.filter(t => t === "delete_file").length;
    expect(deleteCount).toBe(1);
  });
});
