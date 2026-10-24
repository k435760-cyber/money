import {
  categories,
  expenseCategories,
  incomeCategories,
  MAX_INSTALLMENT_MONTHS,
  MAX_AMOUNT,
  monthTransactions,
  planFor,
  sum,
  totalBudget,
} from "./book";
import type { Book, EntryInput, Payment, Category } from "./book";
import { payments, localDate } from "./book";
import { supabase } from "./supabase";
import type { AgeGroup } from "./age";
import { AGE_STORAGE_KEY } from "./age";

export type AiDraft = { input: EntryInput; issues: string[] };
export type AiReply = { reply: string; drafts: AiDraft[]; warnings: string[] };
export type AiImage = {
  data: string;
  mimeType: string;
  preview: string;
  name: string;
};
export type AiMessage = { role: "user" | "model"; text: string };
const strings = (value: unknown, limit: number) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .slice(0, limit)
        .map((text) => text.slice(0, 300))
    : [];
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

export function parseAiReply(value: unknown): AiReply {
  if (
    !object(value) ||
    typeof value.reply !== "string" ||
    !Array.isArray(value.drafts)
  )
    throw new Error("분석 결과를 읽지 못했어요. 다시 시도해주세요.");
  const warnings = strings(value.warnings, 5);
  const drafts: AiDraft[] = [];
  for (const raw of value.drafts.slice(0, 20)) {
    if (!object(raw)) continue;
    const issues = strings(raw.issues, 8);
    let date = typeof raw.date === "string" ? raw.date : "";
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        localDate(new Date(`${date}T12:00:00`)) !== date ||
        date < "1900-01-01" ||
        date > "2100-12-31")
    ) {
      date = "";
      issues.push("날짜를 확인해주세요.");
    }
    if (date > localDate()) {
      warnings.push("미래 날짜의 기록 후보는 제외했어요.");
      continue;
    }
    if (!date) {
      date = localDate();
      issues.push(
        "날짜를 읽지 못해 오늘로 표시했어요. 실제 날짜를 확인해주세요.",
      );
    }
    const amount =
      typeof raw.amount === "number" &&
      Number.isSafeInteger(raw.amount) &&
      raw.amount > 0 &&
      raw.amount <= MAX_AMOUNT
        ? raw.amount
        : 0;
    if (!amount) issues.push("금액을 확인하고 입력해주세요.");
    const kind = raw.kind === "income" ? "income" : "expense";
    const category =
      typeof raw.category === "string" &&
      (kind === "income" ? incomeCategories : expenseCategories).includes(
        raw.category as Category,
      )
        ? (raw.category as Category)
        : kind === "income"
          ? "extra"
          : "other";
    const payment = payments.includes(raw.payment as Payment)
      ? (raw.payment as Payment)
      : "체크카드";
    if (!payments.includes(raw.payment as Payment))
      issues.push("결제 수단을 확인해주세요.");
    const custom =
      ["other", "extra"].includes(category) &&
      typeof raw.custom_category === "string"
        ? raw.custom_category.trim().slice(0, 40)
        : "";
    if (["other", "extra"].includes(category) && !custom)
      issues.push("기타 분류 이름을 입력해주세요.");
    let installment_total: number | null = null,
      installment_months: number | null = null,
      installment_current: number | null = null;
    if (
      [
        raw.installment_total,
        raw.installment_months,
        raw.installment_current,
      ].some((value) => value != null)
    ) {
      const [total, months, current] = [
        raw.installment_total,
        raw.installment_months,
        raw.installment_current,
      ];
      if (
        kind === "expense" &&
        typeof total === "number" &&
        Number.isSafeInteger(total) &&
        total > 0 &&
        total <= MAX_AMOUNT &&
        typeof months === "number" &&
        Number.isInteger(months) &&
        months >= 2 &&
        months <= MAX_INSTALLMENT_MONTHS &&
        total >= months &&
        typeof current === "number" &&
        Number.isInteger(current) &&
        current >= 1 &&
        current <= months
      ) {
        installment_total = total;
        installment_months = months;
        installment_current = current;
      } else
        issues.push(
          "할부 정보를 확인해주세요. 불명확한 할부 정보는 적용하지 않았어요.",
        );
    }
    drafts.push({
      input: {
        date,
        title: typeof raw.title === "string" ? raw.title.slice(0, 100) : "",
        amount,
        kind,
        category,
        payment,
        custom_category: custom,
        installment_total,
        installment_months,
        installment_current,
        memo: typeof raw.memo === "string" ? raw.memo.slice(0, 500) : "",
      },
      issues: [...new Set(issues)],
    });
  }
  return {
    reply: value.reply.slice(0, 4000),
    drafts,
    warnings: [...new Set(warnings)].slice(0, 8),
  };
}

export function assistantContext(book: Book, month: string) {
  const rows = monthTransactions(book.transactions, month);
  const plan = planFor(book, month);
  return {
    month,
    transactionCount: rows.length,
    income: sum(rows, "income"),
    expense: sum(rows, "expense"),
    budget: totalBudget(plan),
    categories: expenseCategories.map((id) => ({
      name: categories[id].label,
      expense: sum(
        rows.filter((row) => row.category === id),
        "expense",
      ),
      budget: plan.budgets[id] || 0,
    })),
    // No account IDs, email, private memos or images are included in the monthly summary.
    recent: [...rows]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30)
      .map(
        ({
          date,
          title,
          amount,
          kind,
          category,
          custom_category,
          installment_total,
          installment_months,
          installment_current,
        }) => ({
          date,
          title,
          amount,
          kind,
          category,
          custom_category,
          installment_total,
          installment_months,
          installment_current,
        }),
      ),
  };
}

export function isDuplicateDraft(book: Book, input: EntryInput) {
  return book.transactions.some(
    (row) =>
      row.date === input.date &&
      row.amount === input.amount &&
      row.kind === input.kind &&
      row.title.trim().replace(/\s+/g, "") ===
        input.title.trim().replace(/\s+/g, ""),
  );
}

export async function askAssistant({
  message,
  image,
  book,
  month,
  history,
  signal,
  ageGroup,
}: {
  message: string;
  image: AiImage | null;
  book: Book;
  month: string;
  history: AiMessage[];
  signal: AbortSignal;
  ageGroup: AgeGroup;
}): Promise<AiReply> {
  const { data: session } = await supabase.auth.getSession();
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_Smg0o4U5qYTkrLygwhVUSA_YM7HwKjM";
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    "https://dbneonomwrqwlbitwdtr.supabase.co";
  const response = await fetch(`${url}/functions/v1/hanpun-ai`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${session.session?.access_token || key}`,
    },
    body: JSON.stringify({
      mode: image ? "receipt" : "chat",
      message,
      today: localDate(),
      ageGroup,
      ageToken: (() => {
        try {
          return JSON.parse(localStorage.getItem(AGE_STORAGE_KEY) || "null")
            ?.token;
        } catch {
          return undefined;
        }
      })(),
      context: assistantContext(book, month),
      history: history.slice(-6),
      ...(image
        ? { image: { data: image.data, mimeType: image.mimeType } }
        : {}),
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      object(result) && typeof result.error === "string"
        ? result.error
        : "도우미에 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  return parseAiReply(result);
}

export async function assessFaceAge(
  image: AiImage,
  signal: AbortSignal,
): Promise<{ message: string }> {
  const { data: session } = await supabase.auth.getSession();
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_Smg0o4U5qYTkrLygwhVUSA_YM7HwKjM";
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    "https://dbneonomwrqwlbitwdtr.supabase.co";
  const response = await fetch(`${url}/functions/v1/hanpun-ai`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${session.session?.access_token || key}`,
    },
    body: JSON.stringify({
      mode: "age",
      today: localDate(),
      message: "얼굴 사진 연령대 추정",
      context: {},
      faceConsent: true,
      image: { data: image.data, mimeType: image.mimeType },
    }),
  });
  const result = await response.json().catch(() => null);
  if (
    !response.ok ||
    !result ||
    !["under14", "14plus", "unknown"].includes(result.age_group) ||
    typeof result.message !== "string" ||
    !Number.isFinite(Date.parse(result.valid_until))
  )
    throw new Error(
      result?.error || "연령대를 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  if (!session.session) {
    if (typeof result.token !== "string")
      throw new Error("연령대 결과를 확인하지 못했어요.");
    localStorage.setItem(
      AGE_STORAGE_KEY,
      JSON.stringify({
        age_group: result.age_group,
        valid_until: result.valid_until,
        token: result.token,
      }),
    );
  }
  return { message: result.message };
}

export async function prepareAiImage(file: File): Promise<AiImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPG, PNG, WebP 이미지를 골라주세요.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("15MB 이하의 이미지를 골라주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 60_000_000
    )
      throw new Error(
        "이미지가 너무 커요. 영수증 부분만 잘라 다시 골라주세요.",
      );
    const scale = Math.min(
      1,
      1800 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이 브라우저에서는 이미지를 읽지 못해요.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const preview = canvas.toDataURL("image/jpeg", 0.88),
      data = preview.split(",")[1];
    if (data.length > 3_500_000)
      throw new Error("영수증 부분만 잘라 더 작은 이미지로 골라주세요.");
    return { data, mimeType: "image/jpeg", preview, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}
