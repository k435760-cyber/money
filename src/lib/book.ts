export const categories = {
  food: { label: "식비", color: "#65784b", icon: "food" },
  cafe: { label: "카페·간식", color: "#a6ad78", icon: "cafe" },
  shopping: { label: "쇼핑", color: "#d2b08b", icon: "shopping" },
  transport: { label: "교통", color: "#839d9b", icon: "transport" },
  living: { label: "주거·생활", color: "#beb9a4", icon: "living" },
  culture: { label: "문화·여가", color: "#b397a7", icon: "culture" },
  health: { label: "건강", color: "#d4997c", icon: "health" },
  other: { label: "기타", color: "#a4a7a0", icon: "other" },
  salary: { label: "급여", color: "#65784b", icon: "salary" },
  extra: { label: "부수입", color: "#839d9b", icon: "extra" },
} as const;

export type Category = keyof typeof categories;
export const expenseCategories: Category[] = [
  "food",
  "cafe",
  "shopping",
  "transport",
  "living",
  "culture",
  "health",
  "other",
];
export const incomeCategories: Category[] = ["salary", "extra"];
export const payments = ["체크카드", "신용카드", "현금", "계좌이체"] as const;
export type Payment = (typeof payments)[number];
export type Kind = "expense" | "income";
export type Transaction = {
  id: string;
  date: string;
  title: string;
  amount: number;
  kind: Kind;
  category: Category;
  payment: Payment;
  memo: string;
};
export type EntryInput = Omit<Transaction, "id">;
export type Plan = {
  month: string;
  budgets: Record<string, number>;
  note: string;
};
export type Book = { transactions: Transaction[]; plans: Plan[] };
export const MAX_AMOUNT = 9_999_999_999;
const numberFormat = new Intl.NumberFormat("ko-KR");
export const money = (amount: number) => numberFormat.format(amount);
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const currentMonth = () => localDate().slice(0, 7);
export const monthLabel = (month: string) =>
  `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월`;
export function shiftMonth(month: string, amount: number) {
  const date = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)) - 1 + amount,
    1,
  );
  return localDate(date).slice(0, 7);
}
export const daysInMonth = (month: string) =>
  new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
export const monthTransactions = (transactions: Transaction[], month: string) =>
  transactions.filter((item) => item.date.startsWith(`${month}-`));
export const sum = (transactions: Transaction[], kind: Kind) =>
  transactions.reduce(
    (total, item) => total + (item.kind === kind ? item.amount : 0),
    0,
  );
export function defaultPlan(month: string): Plan {
  return {
    month,
    budgets: {
      food: 0,
      cafe: 0,
      shopping: 0,
      transport: 0,
      living: 0,
      culture: 0,
      health: 0,
      other: 0,
    },
    note: "",
  };
}
export const planFor = (book: Book, month: string) =>
  book.plans.find((plan) => plan.month === month) ?? defaultPlan(month);
export const totalBudget = (plan: Plan) =>
  expenseCategories.reduce(
    (total, category) => total + (plan.budgets[category] ?? 0),
    0,
  );
export const sortedEntries = (transactions: Transaction[]) =>
  [...transactions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
export function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}
export function validateEntry(entry: EntryInput) {
  if (!entry.title.trim() || entry.title.trim().length > 100)
    throw new Error("내용은 1~100자로 적어주세요.");
  if (
    !Number.isSafeInteger(entry.amount) ||
    entry.amount <= 0 ||
    entry.amount > MAX_AMOUNT
  )
    throw new Error("금액은 1원부터 9,999,999,999원까지 입력할 수 있어요.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
    Number(entry.date.slice(0, 4)) < 1900 ||
    Number(entry.date.slice(0, 4)) > 2100 ||
    localDate(new Date(`${entry.date}T12:00:00`)) !== entry.date
  )
    throw new Error("올바른 날짜를 골라주세요.");
  const allowed =
    entry.kind === "expense"
      ? expenseCategories
      : entry.kind === "income"
        ? incomeCategories
        : [];
  if (!allowed.includes(entry.category))
    throw new Error("기록에 맞는 카테고리를 골라주세요.");
  if (!payments.includes(entry.payment))
    throw new Error("결제 수단을 골라주세요.");
  if (typeof entry.memo !== "string" || entry.memo.length > 500)
    throw new Error("메모는 500자까지 적을 수 있어요.");
}
export function validatePlan(plan: Plan) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(plan.month) ||
    Number(plan.month.slice(0, 4)) < 1900 ||
    Number(plan.month.slice(0, 4)) > 2100
  )
    throw new Error("올바른 월을 골라주세요.");
  if (plan.note.length > 500)
    throw new Error("이달의 메모는 500자까지 적을 수 있어요.");
  if (
    !expenseCategories.every(
      (category) =>
        Number.isSafeInteger(plan.budgets[category]) &&
        plan.budgets[category] >= 0 &&
        plan.budgets[category] <= MAX_AMOUNT,
    )
  )
    throw new Error("예산은 0원부터 9,999,999,999원까지 입력할 수 있어요.");
}

const csvCell = (value: string) =>
  `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
export function exportCsv(transactions: Transaction[]) {
  const rows = [
    ["날짜", "구분", "내용", "카테고리", "결제 수단", "금액(원)", "메모"],
    ...sortedEntries(transactions).map((entry) => [
      entry.date,
      entry.kind === "expense" ? "지출" : "수입",
      entry.title,
      categories[entry.category].label,
      entry.payment,
      String(entry.amount),
      entry.memo,
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
