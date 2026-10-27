import { describe, expect, it, vi } from "vitest";
import {
  daysInMonth,
  defaultPlan,
  exportCsv,
  MAX_AMOUNT,
  monthTransactions,
  shiftMonth,
  sum,
  totalBudget,
  validateEntry,
  validatePlan,
} from "./book";
import type { EntryInput, Transaction } from "./book";

const entry: EntryInput = {
  title: "점심",
  amount: 12000,
  date: "2026-10-23",
  kind: "expense",
  category: "food",
  payment: "체크카드",
  memo: "",
};

describe("calendar boundaries", () => {
  it("moves across year boundaries without skipping months", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
  });
  it("rejects impossible dates rather than silently rolling into another month", () => {
    expect(() => validateEntry({ ...entry, date: "2026-02-29" })).toThrow();
    expect(() => validateEntry({ ...entry, date: "2026-04-31" })).toThrow();
    expect(() => validateEntry({ ...entry, date: "2026-13-01" })).toThrow();
    expect(() => validateEntry({ ...entry, date: "2024-02-29" })).not.toThrow();
  });
});

describe("record dates", () => {
  it("accepts today and past dates but rejects future income and expenses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 12));
    try {
      for (const input of [
        entry,
        { ...entry, kind: "income" as const, category: "salary" as const },
      ]) {
        expect(() =>
          validateEntry({ ...input, date: "2026-10-23" }),
        ).not.toThrow();
        expect(() =>
          validateEntry({ ...input, date: "2026-10-24" }),
        ).not.toThrow();
        expect(() => validateEntry({ ...input, date: "2026-10-25" })).toThrow(
          "미래 날짜",
        );
      }
      expect(() =>
        validateEntry({ ...entry, date: "2026-10-25" }, { allowFuture: true }),
      ).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("financial input", () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_AMOUNT + 1])(
    "rejects an invalid amount: %s",
    (amount) => {
      expect(() => validateEntry({ ...entry, amount })).toThrow();
    },
  );
  it("accepts whole won and the supported maximum", () => {
    expect(() => validateEntry({ ...entry, amount: 1 })).not.toThrow();
    expect(() => validateEntry({ ...entry, amount: MAX_AMOUNT })).not.toThrow();
  });
  it("keeps income and expense categories separate", () => {
    expect(() => validateEntry({ ...entry, category: "salary" })).toThrow();
    expect(() => validateEntry({ ...entry, kind: "income" })).toThrow();
    expect(() =>
      validateEntry({ ...entry, kind: "income", category: "salary" }),
    ).not.toThrow();
  });
  it("rejects empty descriptions and excessive notes", () => {
    expect(() => validateEntry({ ...entry, title: "   " })).toThrow();
    expect(() => validateEntry({ ...entry, memo: "a".repeat(501) })).toThrow();
  });
  it("calculates totals from the selected month and transaction kind", () => {
    const rows: Transaction[] = [
      { ...entry, id: "a" },
      {
        ...entry,
        id: "b",
        kind: "income",
        category: "salary",
        amount: 3000000,
      },
      { ...entry, id: "c", date: "2026-09-30", amount: 500000 },
    ];
    const month = monthTransactions(rows, "2026-10");
    expect(sum(month, "expense")).toBe(12000);
    expect(sum(month, "income")).toBe(3000000);
    expect(monthTransactions(rows, "2026-11")).toHaveLength(0);
  });
});

describe("monthly budgets", () => {
  it("accepts a zero budget and rejects missing, negative, or fractional limits", () => {
    const plan = defaultPlan("2026-10");
    expect(totalBudget(plan)).toBe(0);
    expect(() =>
      validatePlan({ ...plan, budgets: { ...plan.budgets, food: 0 } }),
    ).not.toThrow();
    for (const amount of [-1, 0.5, MAX_AMOUNT + 1])
      expect(() =>
        validatePlan({ ...plan, budgets: { ...plan.budgets, food: amount } }),
      ).toThrow();
    expect(() => validatePlan({ ...plan, budgets: {} })).toThrow();
    expect(() => validatePlan({ ...plan, month: "2026-13" })).toThrow();
  });
});

describe("CSV export", () => {
  it("neutralizes formula prefixes concealed behind whitespace or zero-width characters", () => {
    for (const prefix of [" ", "\t", "\r", "\n", "\u200B", "\uFEFF", " \t"]) {
      const csv = exportCsv([
        { ...entry, id: "csv-security", memo: `${prefix}=1+1` },
      ]);
      expect(csv).toContain(`"'${prefix}=1+1"`);
    }
  });
  it("preserves Korean text, quotes, newlines, and spreadsheet compatibility", () => {
    const csv = exportCsv([
      {
        ...entry,
        id: "a",
        title: '친구와 "점심", 저녁',
        memo: "첫째 줄\n둘째 줄",
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"친구와 ""점심"", 저녁"');
    expect(csv).toContain('"첫째 줄\n둘째 줄"');
    expect(csv).toContain('"12000"');
  });
  it("neutralizes spreadsheet formulas in user-controlled fields", () => {
    for (const prefix of ["=", "+", "-", "@", "\t", "\r"]) {
      const csv = exportCsv([
        { ...entry, id: "a", title: `${prefix}SUM(A1)`, memo: "=1+1" },
      ]);
      expect(csv).toContain(`"'${prefix}SUM(A1)"`);
      expect(csv).toContain('"\'=1+1"');
    }
  });
});
