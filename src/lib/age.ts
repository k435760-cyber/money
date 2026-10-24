import type { EntryInput } from "./book";

export type AgeGroup = "under14" | "14plus" | "unknown";
export const AGE_STORAGE_KEY = "hanpun-age-group-v1";
export const AGE_RESTRICTION =
  "할부·보험 기록은 얼굴 사진으로 연령대를 확인한 뒤 이용할 수 있어요. 만 14세 미만이거나 판정이 불확실하면 제한돼요.";
export const validAgeGroup = (
  value: unknown,
): value is Exclude<AgeGroup, "unknown"> =>
  value === "under14" || value === "14plus";
export function isRestrictedEntry(
  input: Pick<
    EntryInput,
    | "category"
    | "installment_total"
    | "installment_months"
    | "installment_current"
  >,
) {
  return (
    ["insurance", "insurance_payout"].includes(input.category) ||
    [
      input.installment_total,
      input.installment_months,
      input.installment_current,
    ].some((value) => value != null)
  );
}
export function assertAgeAccess(
  input: Parameters<typeof isRestrictedEntry>[0],
  ageGroup: AgeGroup,
) {
  if (ageGroup !== "14plus" && isRestrictedEntry(input))
    throw new Error(AGE_RESTRICTION);
}
