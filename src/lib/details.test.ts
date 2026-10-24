import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  defaultPlan,
  exportCsv,
  installmentAmount,
  validateEntry,
} from "./book";
import type { EntryInput } from "./book";
import { parseBook } from "./repository";
const entry: EntryInput = {
  date: "2020-01-01",
  title: "보험",
  amount: 40000,
  kind: "expense",
  category: "insurance",
  payment: "신용카드",
  memo: "",
};
describe("insurance and custom categories", () => {
  it("separates received insurance money from insurance premiums", () => {
    expect(() => validateEntry(entry)).not.toThrow();
    expect(() =>
      validateEntry({ ...entry, kind: "income", category: "insurance_payout" }),
    ).not.toThrow();
    expect(() =>
      validateEntry({ ...entry, category: "insurance_payout" }),
    ).toThrow();
    expect(() => validateEntry({ ...entry, kind: "income" })).toThrow();
  });
  it("requires the user's custom category and includes it in exports", () => {
    expect(() => validateEntry({ ...entry, category: "other" })).toThrow(
      "기타 분류",
    );
    const other = {
      ...entry,
      category: "other" as const,
      custom_category: "반려동물",
    };
    expect(() => validateEntry(other)).not.toThrow();
    expect(categoryLabel(other)).toBe("기타 · 반려동물");
    expect(exportCsv([{ ...other, id: "1" }])).toContain("반려동물");
    expect(() =>
      validateEntry({ ...other, custom_category: "가".repeat(41) }),
    ).toThrow();
  });
  it("loads old other records and eight-category budgets without deleting anything", () => {
    const { insurance: _, ...oldBudgets } = defaultPlan("2020-01").budgets;
    const book = parseBook({
      transactions: [{ ...entry, id: "legacy", category: "other" }],
      plans: [{ month: "2020-01", budgets: oldBudgets, note: "원래 메모" }],
    });
    expect(book.transactions[0].amount).toBe(40000);
    expect(book.transactions[0].category).toBe("other");
    expect(book.plans[0].budgets.insurance).toBe(0);
    expect(book.plans[0].note).toBe("원래 메모");
  });
});
describe("paid installment accounting", () => {
  it("conserves every won and puts the remainder in the last payment", () => {
    expect([1, 2, 3].map((n) => installmentAmount(100, 3, n))).toEqual([
      33, 33, 34,
    ]);
    expect(
      [1, 2, 3].reduce((sum, n) => sum + installmentAmount(120001, 3, n), 0),
    ).toBe(120001);
  });
  it("accepts actual paid amounts and rejects partial or invalid plans", () => {
    const paid = {
      ...entry,
      installment_total: 120000,
      installment_months: 3,
      installment_current: 1,
    };
    expect(() => validateEntry(paid)).not.toThrow();
    for (const patch of [
      { installment_months: 1 },
      { installment_months: 61 },
      { installment_current: 4 },
      { installment_total: 2 },
      { installment_total: null },
      { kind: "income" as const, category: "insurance_payout" as const },
    ])
      expect(() => validateEntry({ ...paid, ...patch })).toThrow();
    expect(exportCsv([{ ...paid, id: "paid" }])).toContain('"120000","3","1"');
  });
});
