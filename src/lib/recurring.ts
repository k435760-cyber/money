import { daysInMonth, localDate, shiftMonth } from "./book";
import type { EntryInput, Transaction } from "./book";

export type RecurringCandidate = {
  key: string;
  source: Transaction;
  dueDate: string;
  daysUntil: number;
};
const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("ko-KR");
const keyFor = (entry: Transaction) =>
  JSON.stringify([
    normalize(entry.title),
    entry.category,
    entry.payment,
    normalize(entry.custom_category ?? ""),
  ]);

// A conservative reminder, never a scheduled transaction: one payment in each
// of the two preceding months, similar amounts and dates, none paid this month.
export function recurringCandidates(
  entries: Transaction[],
  today = localDate(),
): RecurringCandidate[] {
  const month = today.slice(0, 7);
  const months = [month, shiftMonth(month, -1), shiftMonth(month, -2)];
  const groups = new Map<string, Transaction[][]>();
  for (const entry of entries) {
    if (entry.kind !== "expense" || entry.date > today) continue;
    const index = months.indexOf(entry.date.slice(0, 7));
    if (index < 0) continue;
    const key = keyFor(entry);
    const rows = groups.get(key) ?? [[], [], []];
    rows[index].push(entry);
    groups.set(key, rows);
  }
  const result: RecurringCandidate[] = [];
  for (const [key, [current, previous, older]] of groups) {
    if (current.length || previous.length !== 1 || older.length !== 1) continue;
    const [a, b] = [previous[0], older[0]];
    if (
      [a, b].some((entry) =>
        [
          entry.installment_total,
          entry.installment_months,
          entry.installment_current,
        ].some((value) => value != null),
      )
    )
      continue;
    const [dayA, dayB] = [Number(a.date.slice(8)), Number(b.date.slice(8))];
    if (
      Math.abs(dayA - dayB) > 3 ||
      Math.abs(a.amount - b.amount) > Math.max(a.amount, b.amount) * 0.05
    )
      continue;
    const day = Math.min(Math.max(dayA, dayB), daysInMonth(month));
    const dueDate = `${month}-${String(day).padStart(2, "0")}`;
    result.push({
      key,
      source: a,
      dueDate,
      daysUntil: day - Number(today.slice(8)),
    });
  }
  return result.sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key),
  );
}

export function recurringInput(
  candidate: RecurringCandidate,
  today = localDate(),
): EntryInput {
  const { title, amount, category, payment, custom_category, memo } =
    candidate.source;
  return {
    date: today,
    title,
    amount,
    category,
    payment,
    custom_category,
    memo,
    kind: "expense",
  };
}
