import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/demo-v1.json";
import type { Book } from "./book";
import { removeLegacySamples } from "./legacy";
const original = () => structuredClone(fixture) as Book;
describe("remove original sample data without losing user records", () => {
  it("removes all original entries, budget and note", () => {
    const result = removeLegacySamples(original());
    expect(result.transactions).toEqual([]);
    expect(Object.values(result.plans[0].budgets).every((v) => v === 0)).toBe(
      true,
    );
    expect(result.plans[0].note).toBe("");
  });
  it("preserves added duplicates, edited records and customized plans", () => {
    const book = original();
    const added = { ...book.transactions[0], id: "user-added" };
    book.transactions.unshift(added);
    book.transactions[2].amount = 123456;
    const edited = structuredClone(book.transactions[2]);
    book.plans[0].budgets.food = 550000;
    book.plans[0].note = "내가 쓴 메모";
    const result = removeLegacySamples(book);
    expect(result.transactions).toEqual([added, edited]);
    expect(result.plans).toEqual(book.plans);
    expect(removeLegacySamples(result)).toEqual(result);
  });
  it("preserves unrelated records even when a title matches", () => {
    const book = original();
    book.transactions = [{ ...book.transactions[0], id: "real" }];
    book.plans = [];
    expect(removeLegacySamples(book)).toEqual(book);
  });
  it("handles a book first opened early in a different month", () => {
    const book = original();
    book.transactions.forEach((e) => {
      const current = e.date.startsWith("2026-10");
      e.date = `${current ? "2025-02" : "2025-01"}-${String(current ? Math.min(3, Number(e.date.slice(8))) : Number(e.date.slice(8))).padStart(2, "0")}`;
    });
    book.plans[0].month = "2025-02";
    expect(removeLegacySamples(book).transactions).toEqual([]);
  });
});
