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
      food: 450000,
      cafe: 150000,
      shopping: 300000,
      transport: 150000,
      living: 500000,
      culture: 150000,
      health: 100000,
      other: 100000,
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

export function makeDemoBook(): Book {
  const month = currentMonth();
  const today = new Date().getDate();
  const entries: Transaction[] = [];
  const add = (
    day: number,
    title: string,
    amount: number,
    category: Category,
    kind: Kind = "expense",
    payment: Payment = "체크카드",
  ) => {
    entries.push({
      id: crypto.randomUUID(),
      date: `${month}-${String(Math.min(day, today)).padStart(2, "0")}`,
      title,
      amount,
      category,
      kind,
      payment,
      memo: "",
    });
  };
  add(1, "이번 달 월급", 3200000, "salary", "income", "계좌이체");
  add(1, "우리 집 월세", 450000, "living", "expense", "계좌이체");
  add(2, "장보기 · 동네 마트", 58300, "food");
  add(3, "출근길 커피", 4500, "cafe");
  add(4, "교통카드 충전", 50000, "transport");
  add(5, "좋아하는 작가의 신간", 17800, "culture");
  add(6, "점심 · 따뜻한 국수", 9500, "food");
  add(7, "가을 니트 한 벌", 69000, "shopping", "expense", "신용카드");
  add(8, "동네 빵집", 12800, "cafe");
  add(9, "친구와 저녁", 38000, "food");
  add(10, "휴대폰 요금", 45000, "living", "expense", "계좌이체");
  add(11, "주말 장보기", 64200, "food");
  add(12, "넷플릭스 정기결제", 17000, "culture", "expense", "신용카드");
  add(13, "산책 후 아메리카노", 4800, "cafe");
  add(14, "프리랜서 작업비", 250000, "extra", "income", "계좌이체");
  add(15, "운동화", 89000, "shopping", "expense", "신용카드");
  add(16, "영양제", 32000, "health");
  add(17, "작은 꽃 한 다발", 12000, "other", "expense", "현금");
  add(18, "주말 브런치", 24500, "food");
  add(19, "전시 · 가을의 풍경", 18000, "culture");
  add(20, "장보기 · 제철 과일", 28600, "food");
  add(21, "퇴근길 버스", 1500, "transport");
  add(22, "오후의 커피 한 잔", 5500, "cafe");
  add(23, "동네 식당에서 점심", 11000, "food");
  const previous = shiftMonth(month, -1);
  for (let day = 1; day <= 28; day++) {
    entries.push({
      id: crypto.randomUUID(),
      date: `${previous}-${String(day).padStart(2, "0")}`,
      title: day === 1 ? "지난달 월급" : "지난달의 기록",
      amount:
        day === 1 ? 3200000 : day === 2 ? 450000 : 18000 + (day % 5) * 6000,
      kind: day === 1 ? "income" : "expense",
      category:
        day === 1
          ? "salary"
          : day === 2
            ? "living"
            : expenseCategories[day % 8],
      payment: "체크카드",
      memo: "",
    });
  }
  return {
    transactions: entries,
    plans: [
      {
        ...defaultPlan(month),
        note: "가을엔 가까운 곳으로 산책을 자주 가기.\n물건보다 좋은 시간을 모아보자.",
      },
    ],
  };
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
