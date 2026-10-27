export const categories = {
  food: { label: "식비", color: "#65784b", icon: "food" },
  cafe: { label: "카페·간식", color: "#a6ad78", icon: "cafe" },
  shopping: { label: "쇼핑", color: "#d2b08b", icon: "shopping" },
  transport: { label: "교통", color: "#839d9b", icon: "transport" },
  living: { label: "주거·생활", color: "#beb9a4", icon: "living" },
  culture: { label: "문화·여가", color: "#b397a7", icon: "culture" },
  health: { label: "건강", color: "#d4997c", icon: "health" },
  insurance: { label: "보험료", color: "#8a9c89", icon: "insurance" },
  insurance_payout: { label: "보험금", color: "#6b9186", icon: "insurance" },
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
  "insurance",
  "other",
];
export const incomeCategories: Category[] = [
  "salary",
  "insurance_payout",
  "extra",
];
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
  custom_category?: string;
  installment_total?: number | null;
  installment_months?: number | null;
  installment_current?: number | null;
};
export type EntryInput = Omit<Transaction, "id">;
export type Plan = {
  month: string;
  budgets: Record<string, number>;
  note: string;
};
export type Book = { transactions: Transaction[]; plans: Plan[] };
export const MAX_INSTALLMENT_MONTHS = 60;
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
      insurance: 0,
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
export function validateEntry(
  entry: EntryInput,
  {
    allowFuture = false,
    allowLegacyOther = false,
  }: { allowFuture?: boolean; allowLegacyOther?: boolean } = {},
) {
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
  if (!allowFuture && entry.date > localDate())
    throw new Error(
      "미래 날짜에는 기록할 수 없어요. 오늘 또는 이전 날짜를 골라주세요.",
    );
  const allowed =
    entry.kind === "expense"
      ? expenseCategories
      : entry.kind === "income"
        ? incomeCategories
        : [];
  if (!allowed.includes(entry.category))
    throw new Error("기록에 맞는 카테고리를 골라주세요.");
  const custom = entry.custom_category ?? "";
  if (typeof custom !== "string" || custom.trim().length > 40)
    throw new Error("기타 분류는 40자 이내로 적어주세요.");
  if (
    !allowLegacyOther &&
    ["other", "extra"].includes(entry.category) &&
    !custom.trim()
  )
    throw new Error("기타 분류를 입력해주세요.");
  const parts = [
    entry.installment_total,
    entry.installment_months,
    entry.installment_current,
  ];
  if (parts.some((value) => value != null)) {
    const [total, months, current] = parts;
    if (
      entry.kind !== "expense" ||
      !Number.isSafeInteger(total) ||
      total! < 1 ||
      total! > MAX_AMOUNT ||
      !Number.isSafeInteger(months) ||
      months! < 2 ||
      months! > MAX_INSTALLMENT_MONTHS ||
      total! < months! ||
      !Number.isSafeInteger(current) ||
      current! < 1 ||
      current! > months!
    )
      throw new Error(
        "총 할부금액, 2~60개월의 할부 기간과 이번 회차를 확인해주세요.",
      );
  }
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

export const categoryLabel = (
  entry: Pick<Transaction, "category" | "custom_category">,
) =>
  ["other", "extra"].includes(entry.category) && entry.custom_category?.trim()
    ? `${categories[entry.category].label} · ${entry.custom_category.trim()}`
    : categories[entry.category].label;
export function installmentAmount(
  total: number,
  months: number,
  current: number,
): number {
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(months) ||
    !Number.isSafeInteger(current) ||
    months < 2 ||
    current < 1 ||
    current > months
  )
    return 0;
  return Math.floor(total / months) + (current === months ? total % months : 0);
}

const csvCell = (value: string) =>
  `"${(/^[\s\u200B-\u200D\uFEFF]*[=+\-@]|^[\t\r\n]/u.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
export function exportCsv(transactions: Transaction[]) {
  const rows = [
    [
      "날짜",
      "구분",
      "내용",
      "카테고리",
      "결제 수단",
      "금액(원)",
      "메모",
      "기타 분류",
      "할부 총액(원)",
      "할부 개월",
      "이번 회차",
    ],
    ...sortedEntries(transactions).map((entry) => [
      entry.date,
      entry.kind === "expense" ? "지출" : "수입",
      entry.title,
      categoryLabel(entry),
      entry.payment,
      String(entry.amount),
      entry.memo,
      entry.custom_category ?? "",
      entry.installment_total == null ? "" : String(entry.installment_total),
      entry.installment_months == null ? "" : String(entry.installment_months),
      entry.installment_current == null
        ? ""
        : String(entry.installment_current),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
