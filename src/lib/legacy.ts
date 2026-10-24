import { defaultPlan, shiftMonth } from "./book";
import type { Book, Transaction, Category, Kind, Payment } from "./book";
const legacyBudgets = {
  food: 450000,
  cafe: 150000,
  shopping: 300000,
  transport: 150000,
  living: 500000,
  culture: 150000,
  health: 100000,
  other: 100000,
};
const sampleNote =
  "가을엔 가까운 곳으로 산책을 자주 가기.\n물건보다 좋은 시간을 모아보자.";
const fingerprint = (entry: Transaction) =>
  JSON.stringify([
    entry.date,
    entry.title,
    entry.amount,
    entry.kind,
    entry.category,
    entry.payment,
    entry.memo,
  ]);

// Only used to identify unchanged records from the original sample book.
function legacySamples(month: string, today: number): Book {
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
      id: "",
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
      id: "",
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
            : (
                [
                  "food",
                  "cafe",
                  "shopping",
                  "transport",
                  "living",
                  "culture",
                  "health",
                  "other",
                ] as Category[]
              )[day % 8],
      payment: "체크카드",
      memo: "",
    });
  }
  return {
    transactions: entries,
    plans: [
      {
        ...defaultPlan(month),
        budgets: legacyBudgets,
        note: "가을엔 가까운 곳으로 산책을 자주 가기.\n물건보다 좋은 시간을 모아보자.",
      },
    ],
  };
}

export function removeLegacySamples(book: Book): Book {
  const removed = new Set<number>();
  const seededMonths = new Set<string>();
  const months = new Set(
    book.transactions
      .filter((e) => e.title !== "지난달의 기록" && e.title !== "지난달 월급")
      .map((e) => e.date.slice(0, 7)),
  );
  for (const month of months) {
    const candidates = book.transactions.filter((e) =>
      e.date.startsWith(month),
    );
    const today = Math.max(
      1,
      ...candidates
        .filter((e) =>
          legacySamples(month, 31).transactions.some(
            (s) => s.title === e.title && s.amount === e.amount,
          ),
        )
        .map((e) => Number(e.date.slice(8))),
    );
    const samples = legacySamples(month, today).transactions;
    const keys = new Set(candidates.map(fingerprint));
    if (
      samples.filter(
        (e) => e.date.startsWith(month) && keys.has(fingerprint(e)),
      ).length < 8
    )
      continue;
    seededMonths.add(month);
    for (const sample of samples) {
      const key = fingerprint(sample);
      for (let i = book.transactions.length - 1; i >= 0; i--) {
        if (!removed.has(i) && fingerprint(book.transactions[i]) === key) {
          removed.add(i);
          break;
        }
      }
    }
  }
  return {
    transactions: book.transactions.filter((_, i) => !removed.has(i)),
    plans: book.plans.map((plan) => {
      const isSeed = seededMonths.has(plan.month) || plan.note === sampleNote;
      const unchangedBudget = Object.entries(legacyBudgets).every(
        ([key, value]) => plan.budgets[key] === value,
      );
      return {
        ...plan,
        budgets:
          isSeed && unchangedBudget
            ? defaultPlan(plan.month).budgets
            : plan.budgets,
        note: plan.note === sampleNote ? "" : plan.note,
      };
    }),
  };
}
