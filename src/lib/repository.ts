import { supabase } from "./supabase";
import { validateEntry, validatePlan } from "./book";
import type { Book, EntryInput, Plan, Transaction } from "./book";
import {
  AGE_STORAGE_KEY,
  assertAgeAccess,
  validAgeGroup,
  AGE_RESTRICTION,
} from "./age";
import type { AgeGroup } from "./age";

export async function loadAgeGroup(userId?: string): Promise<AgeGroup> {
  if (!userId) {
    const raw = localStorage.getItem(AGE_STORAGE_KEY);
    try {
      const value = raw ? JSON.parse(raw) : null;
      return validAgeGroup(value?.age_group) &&
        typeof value?.token === "string" &&
        Date.parse(value.valid_until) > Date.now()
        ? value.age_group
        : "unknown";
    } catch {
      return "unknown";
    }
  }
  const { data, error } = await supabase
    .from("hanpun_age_profiles")
    .select("age_group,valid_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return validAgeGroup(data?.age_group) &&
    Date.parse(data.valid_until) > Date.now()
    ? data.age_group
    : "unknown";
}

const DEMO_KEY = "hanpun-local-v2";
import { removeLegacySamples } from "./legacy";
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function parseBook(value: unknown): Book {
  if (
    !isObject(value) ||
    !Array.isArray(value.transactions) ||
    !Array.isArray(value.plans)
  )
    throw new Error(
      "저장된 가계부를 읽을 수 없어요. CSV 백업이나 브라우저 저장 공간을 확인해주세요.",
    );
  for (const entry of value.transactions) {
    if (
      !isObject(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.title !== "string" ||
      typeof entry.date !== "string"
    )
      throw new Error("저장된 기록의 형식이 올바르지 않아요.");
    validateEntry(entry as Transaction, {
      allowFuture: true,
      allowLegacyOther: true,
    });
  }
  for (const plan of value.plans) {
    if (
      !isObject(plan) ||
      typeof plan.month !== "string" ||
      typeof plan.note !== "string" ||
      !isObject(plan.budgets)
    )
      throw new Error("저장된 예산의 형식이 올바르지 않아요.");
    (plan as Plan).budgets.insurance ??= 0;
    validatePlan(plan as Plan);
  }
  return value as Book;
}

function readDemo(): Book {
  const raw = localStorage.getItem(DEMO_KEY);
  if (raw) return parseBook(JSON.parse(raw));
  const legacy = localStorage.getItem("hanpun-demo-v1");
  const book: Book = legacy
    ? removeLegacySamples(parseBook(JSON.parse(legacy)))
    : { transactions: [], plans: [] };
  localStorage.setItem(DEMO_KEY, JSON.stringify(book));
  return book;
}
function writeDemo(book: Book) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(book));
  } catch {
    throw new Error(
      "브라우저 저장 공간이 부족해 저장하지 못했어요. 공간을 확보한 뒤 다시 시도해주세요.",
    );
  }
}

export async function loadBook(userId?: string): Promise<Book> {
  if (!userId) return readDemo();
  const transactions: Transaction[] = [];
  const plans: Plan[] = [];
  // Supabase caps each response at 1,000 rows. Read every page before calculating totals.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("hanpun_transactions")
      .select(
        "id,date,title,amount,kind,category,payment,memo,custom_category,installment_total,installment_months,installment_current",
      )
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 999);
    if (error) throw error;
    transactions.push(...(data as Transaction[]));
    if (data.length < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("hanpun_monthly_plans")
      .select("month,budgets,note")
      .eq("user_id", userId)
      .order("month")
      .range(offset, offset + 999);
    if (error) throw error;
    plans.push(
      ...(data.map((row) => ({
        ...row,
        month: row.month.slice(0, 7),
      })) as Plan[]),
    );
    if (data.length < 1000) break;
  }
  return parseBook({ transactions, plans });
}

export async function saveEntry(
  input: EntryInput,
  id?: string,
  userId?: string,
): Promise<Transaction> {
  const entry = {
    ...input,
    title: input.title.trim(),
    memo: input.memo.trim(),
    custom_category: ["other", "extra"].includes(input.category)
      ? (input.custom_category ?? "").trim()
      : "",
    installment_total: input.installment_total ?? null,
    installment_months: input.installment_months ?? null,
    installment_current: input.installment_current ?? null,
    id: id ?? crypto.randomUUID(),
  };
  validateEntry(entry);
  assertAgeAccess(entry, await loadAgeGroup(userId));
  if (!userId) {
    const book = readDemo();
    book.transactions = id
      ? book.transactions.map((old) => (old.id === id ? entry : old))
      : [entry, ...book.transactions];
    writeDemo(book);
    return entry;
  }
  const row = { ...entry, user_id: userId };
  const query = id
    ? supabase
        .from("hanpun_transactions")
        .update(row)
        .eq("id", id)
        .eq("user_id", userId)
    : supabase.from("hanpun_transactions").insert(row);
  const { data, error } = await query
    .select(
      "id,date,title,amount,kind,category,payment,memo,custom_category,installment_total,installment_months,installment_current",
    )
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function deleteEntry(id: string, userId?: string) {
  if (!userId) {
    const book = readDemo();
    book.transactions = book.transactions.filter((entry) => entry.id !== id);
    writeDemo(book);
    return;
  }
  const { data, error } = await supabase
    .from("hanpun_transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .single();
  if (error || !data)
    throw (
      error ?? new Error("기록을 찾지 못했어요. 새로고침 후 다시 시도해주세요.")
    );
}

export async function savePlan(plan: Plan, userId?: string) {
  validatePlan(plan);
  if (plan.budgets.insurance > 0 && (await loadAgeGroup(userId)) !== "14plus")
    throw new Error(AGE_RESTRICTION);
  if (!userId) {
    const book = readDemo();
    book.plans = [
      ...book.plans.filter((old) => old.month !== plan.month),
      plan,
    ];
    writeDemo(book);
    return;
  }
  const { error } = await supabase
    .from("hanpun_monthly_plans")
    .upsert(
      { ...plan, month: `${plan.month}-01`, user_id: userId },
      { onConflict: "user_id,month" },
    );
  if (error) throw error;
}

export function friendlyError(error: unknown) {
  if (isObject(error) && error.code === "42501")
    return "저장 권한을 확인해주세요. 할부·보험 기능은 얼굴 사진의 연령대 판정이 필요해요.";
  if (
    error instanceof Error &&
    !/fetch|network|JWT|token|Postgrest|Auth/i.test(error.message)
  )
    return error.message;
  return "연결이 원활하지 않아 완료하지 못했어요. 잠시 후 다시 시도해주세요.";
}
