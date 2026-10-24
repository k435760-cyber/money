import { describe, expect, it } from "vitest";
import { assertAgeAccess } from "./age";
describe("restricted financial inputs", () => {
  it("allows ordinary entries, but denies insurance and every installment field without a current adult estimate", () => {
    expect(() =>
      assertAgeAccess({ category: "food" }, "under14"),
    ).not.toThrow();
    for (const age of ["unknown", "under14"] as const)
      for (const patch of [
        { category: "insurance" as const },
        { category: "insurance_payout" as const },
        { category: "food" as const, installment_total: 100 },
        { category: "food" as const, installment_months: 3 },
        { category: "food" as const, installment_current: 1 },
      ])
        expect(() => assertAgeAccess(patch, age)).toThrow();
    expect(() =>
      assertAgeAccess({ category: "insurance" }, "14plus"),
    ).not.toThrow();
  });
});
