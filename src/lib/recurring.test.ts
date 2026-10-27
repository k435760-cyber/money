import { describe, expect, it } from "vitest";
import { recurringCandidates, recurringInput } from "./recurring";
import type { Transaction } from "./book";
const make = (
  id: string,
  date: string,
  patch: Partial<Transaction> = {},
): Transaction => ({
  id,
  date,
  title: "월 구독",
  amount: 12000,
  kind: "expense",
  category: "culture",
  payment: "신용카드",
  memo: "",
  ...patch,
});
describe("monthly recurring payment reminders", () => {
  it("finds two consecutive monthly payments, without adding money or future records", () => {
    const entries = [make("a", "2026-08-29"), make("b", "2026-09-29")];
    const result = recurringCandidates(entries, "2026-10-27");
    expect(result).toHaveLength(1);
    expect(result[0].dueDate).toBe("2026-10-29");
    expect(result[0].daysUntil).toBe(2);
    expect(recurringInput(result[0], "2026-10-27").date).toBe("2026-10-27");
    expect(entries).toHaveLength(2);
  });
  it("removes a reminder after this month's payment, even when its amount changed", () => {
    expect(
      recurringCandidates(
        [
          make("a", "2026-08-29"),
          make("b", "2026-09-29"),
          make("c", "2026-10-27", { amount: 16000 }),
        ],
        "2026-10-27",
      ),
    ).toEqual([]);
  });
  it("rejects frequent purchases, skipped months, inconsistent amounts, incomes and installments", () => {
    const a = make("a", "2026-08-10"),
      b = make("b", "2026-09-10");
    for (const entries of [
      [a, b, make("c", "2026-09-11")],
      [{ ...a, date: "2026-07-10" }, b],
      [a, { ...b, amount: 20000 }],
      [{ ...a, kind: "income" as const }, b],
      [
        a,
        {
          ...b,
          installment_months: 3,
          installment_total: 36000,
          installment_current: 2,
        },
      ],
    ])
      expect(recurringCandidates(entries, "2026-10-01")).toEqual([]);
  });
  it("handles year changes, February and month-end payments", () => {
    const result = recurringCandidates(
      [make("a", "2025-12-31"), make("b", "2026-01-31")],
      "2026-02-01",
    );
    expect(result[0].dueDate).toBe("2026-02-28");
    expect(
      recurringCandidates(
        [make("a", "2024-01-31"), make("b", "2024-02-29")],
        "2024-03-01",
      )[0].dueDate,
    ).toBe("2024-03-31");
  });
  it("normalizes merchant spacing while keeping payment methods and custom categories separate", () => {
    expect(
      recurringCandidates(
        [
          make("a", "2026-08-01", { title: " 구독  서비스 " }),
          make("b", "2026-09-01", { title: "구독 서비스" }),
        ],
        "2026-10-01",
      ),
    ).toHaveLength(1);
    expect(
      recurringCandidates(
        [make("a", "2026-08-01"), make("b", "2026-09-01", { payment: "현금" })],
        "2026-10-01",
      ),
    ).toHaveLength(0);
  });
});
