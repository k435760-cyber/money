import { useState } from "react";
import type { FormEvent } from "react";
import { Check } from "lucide-react";
import {
  categories,
  expenseCategories,
  MAX_AMOUNT,
  money,
  monthLabel,
  totalBudget,
  validatePlan,
} from "../lib/book";
import type { Plan } from "../lib/book";
import { friendlyError } from "../lib/repository";
import { CategoryIcon } from "./Icons";
import { Modal } from "./Modal";
import type { AgeGroup } from "../lib/age";

export function PlanForm({
  plan,
  mode,
  ageGroup,
  onAgeSettings,
  onSave,
  onClose,
}: {
  plan: Plan;
  mode: "budget" | "note";
  ageGroup: AgeGroup;
  onAgeSettings: () => void;
  onSave: (plan: Plan) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Plan>({
    ...plan,
    budgets: { ...plan.budgets },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      validatePlan(draft);
      setBusy(true);
      await onSave(draft);
      onClose();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={mode === "budget" ? "이달의 예산 정하기" : "나에게 남기는 메모"}
      description={`${monthLabel(plan.month)} · ${mode === "budget" ? "무리하지 않고, 나에게 맞는 만큼." : "이번 달 기억하고 싶은 마음을 적어보세요."}`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="plan-form">
        <fieldset disabled={busy} className="form-fields">
          {mode === "budget" ? (
            <>
              <div className="budget-form-total">
                <span>총 예산</span>
                <strong>
                  {money(totalBudget(draft))}
                  <small>원</small>
                </strong>
              </div>
              <div className="budget-inputs">
                {expenseCategories.map((category) => (
                  <label key={category}>
                    <span>
                      <CategoryIcon category={category} />
                      {categories[category].label}
                    </span>
                    <span className="budget-input-wrap">
                      <input
                        aria-label={`${categories[category].label} 예산`}
                        inputMode="numeric"
                        disabled={
                          category === "insurance" && ageGroup !== "14plus"
                        }
                        value={money(draft.budgets[category] ?? 0)}
                        onChange={(event) => {
                          const value = event.target.value.replaceAll(",", "");
                          if (
                            /^\d*$/.test(value) &&
                            Number(value) <= MAX_AMOUNT
                          )
                            setDraft((old) => ({
                              ...old,
                              budgets: {
                                ...old.budgets,
                                [category]: Number(value),
                              },
                            }));
                        }}
                      />
                      <span>원</span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <label className="form-label">
                이달의 메모
                <textarea
                  rows={7}
                  autoFocus
                  maxLength={500}
                  placeholder="작은 다짐, 기억에 남는 소비, 다음 달의 나에게…"
                  value={draft.note}
                  onChange={(event) =>
                    setDraft((old) => ({ ...old, note: event.target.value }))
                  }
                />
              </label>
              <p className="character-count">{draft.note.length} / 500</p>
            </>
          )}
        </fieldset>
        {ageGroup !== "14plus" && (
          <div className="age-notice">
            <p>
              보험료 예산은 AI 연령대 확인 후 이용할 수 있어요. 만 14세
              미만이거나 판정이 불확실하면 제한돼요.
            </p>
            <button
              type="button"
              className="text-button"
              onClick={onAgeSettings}
            >
              AI 연령대 확인
            </button>
            {draft.budgets.insurance > 0 && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setDraft((old) => ({
                    ...old,
                    budgets: { ...old.budgets, insurance: 0 },
                  }))
                }
              >
                기존 보험료 예산을 0원으로 바꾸기
              </button>
            )}
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            취소
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "저장 중…" : "저장하기"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
