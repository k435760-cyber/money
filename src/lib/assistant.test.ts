import { describe, expect, it, vi } from "vitest";
import { assistantContext, isDuplicateDraft, parseAiReply } from "./assistant";
import type { Book, EntryInput } from "./book";
const input: EntryInput = {
  date: "2026-10-20",
  title: "동네 식당",
  amount: 11000,
  kind: "expense",
  category: "food",
  payment: "현금",
  memo: "",
};
describe("AI extraction is untrusted financial input", () => {
  it("keeps missing amounts editable instead of inventing money", () => {
    const result = parseAiReply({
      reply: "확인해주세요.",
      warnings: [],
      drafts: [{ ...input, amount: null, date: null, payment: null }],
    });
    expect(result.drafts[0].input.amount).toBe(0);
    expect(result.drafts[0].issues.join(" ")).toContain("금액");
    expect(result.drafts[0].issues.join(" ")).toContain("날짜");
    expect(result.drafts[0].issues.join(" ")).toContain("결제 수단");
  });
  it("excludes future transactions and flags invalid dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 12));
    try {
      const result = parseAiReply({
        reply: "확인",
        warnings: [],
        drafts: [
          { ...input, date: "2026-10-24" },
          { ...input, date: "2026-02-30" },
        ],
      });
      expect(result.drafts).toHaveLength(1);
      expect(result.drafts[0].input.date).toBe("2026-10-23");
      expect(result.warnings.join(" ")).toContain("미래");
    } finally {
      vi.useRealTimers();
    }
  });
  it("rejects malformed responses and unsafe amounts", () => {
    expect(() => parseAiReply({ reply: "ok" })).toThrow();
    for (const amount of [-1, 1.1, Infinity, 10_000_000_000])
      expect(
        parseAiReply({ reply: "확인", drafts: [{ ...input, amount }] })
          .drafts[0].input.amount,
      ).toBe(0);
  });
  it("detects existing duplicates without mixing income and expenses", () => {
    const book: Book = { transactions: [{ ...input, id: "real" }], plans: [] };
    expect(isDuplicateDraft(book, { ...input, title: "동네식당" })).toBe(true);
    expect(isDuplicateDraft(book, { ...input, kind: "income" })).toBe(false);
  });
  it("sends the selected month's actual sums while omitting IDs and private memos", () => {
    const book: Book = {
      transactions: [
        { ...input, id: "private-id", memo: "private-note" },
        { ...input, id: "outside", date: "2026-09-01", amount: 99999 },
      ],
      plans: [],
    };
    const context = assistantContext(book, "2026-10");
    expect(context.expense).toBe(11000);
    expect(context.income).toBe(0);
    expect(context.budget).toBe(0);
    expect(context.transactionCount).toBe(1);
    expect(JSON.stringify(context)).not.toContain("private-id");
    expect(JSON.stringify(context)).not.toContain("private-note");
  });
});
