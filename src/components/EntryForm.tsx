import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Check, Trash2 } from "lucide-react";
import {
  categories,
  expenseCategories,
  incomeCategories,
  installmentAmount,
  localDate,
  MAX_AMOUNT,
  money,
  payments,
  validateEntry,
} from "../lib/book";
import type { EntryInput, Kind, Transaction } from "../lib/book";
import { friendlyError } from "../lib/repository";
import { CategoryIcon } from "./Icons";
import { ChoicePicker, DatePicker } from "./Pickers";
import { Modal } from "./Modal";
import { assertAgeAccess, AGE_RESTRICTION } from "../lib/age";
import type { AgeGroup } from "../lib/age";

export function EntryForm({
  entry,
  initialInput,
  date,
  isDemo,
  ageGroup,
  onAgeSettings,
  onSave,
  onDelete,
  onClose,
}: {
  entry?: Transaction;
  initialInput?: EntryInput;
  date?: string;
  isDemo: boolean;
  ageGroup: AgeGroup;
  onAgeSettings: () => void;
  onSave: (input: EntryInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [input, setInput] = useState<EntryInput>(
    entry ??
      initialInput ?? {
        date: date ?? localDate(),
        title: "",
        amount: 0,
        kind: "expense",
        category: "food",
        payment: "체크카드",
        memo: "",
      },
  );
  const [otherEditor, setOtherEditor] = useState<{
    category: EntryInput["category"];
    text: string;
  } | null>(null);
  const [otherError, setOtherError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) =>
    setInput((old) => ({ ...old, [key]: value }));
  const changeKind = (kind: Kind) =>
    setInput((old) => ({
      ...old,
      kind,
      category: kind === "expense" ? "food" : "salary",
      custom_category: "",
      installment_total: null,
      installment_months: null,
      installment_current: null,
    }));
  function chooseCategory(category: EntryInput["category"]) {
    if (
      ["insurance", "insurance_payout"].includes(category) &&
      ageGroup !== "14plus"
    ) {
      if (ageGroup === "unknown") onAgeSettings();
      return;
    }
    if (["other", "extra"].includes(category)) {
      setOtherError("");
      setOtherEditor({ category, text: input.custom_category ?? "" });
    } else setInput((old) => ({ ...old, category, custom_category: "" }));
  }
  function setInstallment(enabled: boolean) {
    if (enabled && ageGroup !== "14plus") {
      if (ageGroup === "unknown") onAgeSettings();
      return;
    }
    setInput((old) =>
      enabled
        ? {
            ...old,
            installment_total: old.amount,
            installment_months: 3,
            installment_current: 1,
            amount: installmentAmount(old.amount, 3, 1),
          }
        : {
            ...old,
            amount: old.installment_total ?? old.amount,
            installment_total: null,
            installment_months: null,
            installment_current: null,
          },
    );
  }
  function changeInstallment(
    field: "installment_total" | "installment_months" | "installment_current",
    value: number,
  ) {
    setInput((old) => {
      const next = { ...old, [field]: value };
      if (field === "installment_months")
        next.installment_current = Math.min(
          next.installment_current ?? 1,
          value || 1,
        );
      return {
        ...next,
        amount: installmentAmount(
          next.installment_total ?? 0,
          next.installment_months ?? 0,
          next.installment_current ?? 0,
        ),
      };
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      validateEntry(input);
      assertAgeAccess(input, ageGroup);
      setBusy(true);
      await onSave(input, entry?.id);
      onClose();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!entry) return;
    setBusy(true);
    setError("");
    try {
      await onDelete(entry.id);
      onClose();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={entry ? "기록 수정하기" : "오늘의 기록"}
      description="작은 씀씀이도, 기분 좋은 수입도 남겨보세요."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="entry-form" noValidate>
        <fieldset disabled={busy} className="form-fields">
          <div
            className="segmented kind-toggle"
            role="group"
            aria-label="기록 구분"
          >
            <button
              type="button"
              aria-pressed={input.kind === "expense"}
              className={input.kind === "expense" ? "selected" : ""}
              onClick={() => changeKind("expense")}
            >
              지출
            </button>
            <button
              type="button"
              aria-pressed={input.kind === "income"}
              className={input.kind === "income" ? "selected income" : ""}
              onClick={() => changeKind("income")}
            >
              수입
            </button>
          </div>
          <label className="form-label amount-field">
            {input.installment_months != null ? "이번 회차 금액" : "금액"}
            <div>
              <span>₩</span>
              <input
                aria-label="금액"
                inputMode="numeric"
                autoComplete="off"
                value={input.amount ? money(input.amount) : ""}
                placeholder="0"
                required
                onChange={(event) => {
                  const value = event.target.value.replaceAll(",", "");
                  if (/^\d*$/.test(value) && Number(value) <= MAX_AMOUNT)
                    update("amount", Number(value));
                }}
              />
              <span>원</span>
            </div>
          </label>
          <div className="form-two">
            <label className="form-label">
              내용
              <input
                name="title"
                value={input.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder={
                  input.kind === "expense"
                    ? "어디에 쓰셨나요?"
                    : "어떤 수입인가요?"
                }
                maxLength={100}
                required
              />
            </label>
            <div className="form-label">
              <span>날짜</span>
              <DatePicker
                value={input.date}
                onChange={(value) => update("date", value)}
              />
            </div>
          </div>
          <fieldset className="category-field">
            <legend>카테고리</legend>
            <div className="category-options">
              {(input.kind === "expense"
                ? expenseCategories
                : incomeCategories
              ).map((category) => (
                <button
                  type="button"
                  key={category}
                  disabled={
                    ageGroup === "under14" &&
                    ["insurance", "insurance_payout"].includes(category)
                  }
                  className={input.category === category ? "chosen" : ""}
                  aria-pressed={input.category === category}
                  onClick={() => chooseCategory(category)}
                >
                  <CategoryIcon category={category} size={18} />
                  {categories[category].label}
                </button>
              ))}
            </div>
          </fieldset>
          {ageGroup !== "14plus" && (
            <div className="age-notice">
              <p>
                {ageGroup === "under14"
                  ? "만 14세 미만으로 추정되어 할부·보험 입력이 제한돼요. 기존 기록은 조회하거나 삭제할 수 있어요."
                  : AGE_RESTRICTION}
              </p>
              <button
                type="button"
                className="text-button"
                onClick={onAgeSettings}
              >
                AI 연령대 확인
              </button>
            </div>
          )}
          {["other", "extra"].includes(input.category) && (
            <div className="custom-category-summary">
              <span>
                기타 분류 · {input.custom_category || "이름을 입력해주세요"}
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => chooseCategory(input.category)}
              >
                분류 이름 수정
              </button>
            </div>
          )}
          <div className="form-label">
            <span>결제 수단</span>
            <ChoicePicker
              label="결제 수단"
              value={input.payment}
              options={payments.map((value) => ({ value, label: value }))}
              onChange={(value) =>
                update("payment", value as EntryInput["payment"])
              }
            />
          </div>
          {input.kind === "expense" && (
            <div className="installment-fields">
              <label className="installment-toggle">
                <input
                  type="checkbox"
                  disabled={
                    ageGroup === "under14" && input.installment_months == null
                  }
                  checked={input.installment_months != null}
                  onChange={(event) => setInstallment(event.target.checked)}
                />
                할부로 기록하기
              </label>
              {input.installment_months != null && (
                <>
                  <label className="form-label">
                    총 할부금액
                    <input
                      aria-label="총 할부금액"
                      inputMode="numeric"
                      value={
                        input.installment_total
                          ? money(input.installment_total)
                          : ""
                      }
                      placeholder="0"
                      onChange={(event) => {
                        const value = event.target.value.replaceAll(",", "");
                        if (/^\d*$/.test(value) && Number(value) <= MAX_AMOUNT)
                          changeInstallment("installment_total", Number(value));
                      }}
                    />
                  </label>
                  <div className="form-two">
                    <label className="form-label">
                      할부 개월
                      <input
                        aria-label="할부 개월"
                        inputMode="numeric"
                        value={input.installment_months || ""}
                        onChange={(event) => {
                          if (/^\d{0,2}$/.test(event.target.value))
                            changeInstallment(
                              "installment_months",
                              Number(event.target.value),
                            );
                        }}
                      />
                    </label>
                    <label className="form-label">
                      이번 회차
                      <input
                        aria-label="이번 회차"
                        inputMode="numeric"
                        value={input.installment_current || ""}
                        onChange={(event) => {
                          if (/^\d{0,2}$/.test(event.target.value))
                            changeInstallment(
                              "installment_current",
                              Number(event.target.value),
                            );
                        }}
                      />
                    </label>
                  </div>
                  <p className="form-hint">
                    할부 정보를 바꾸면 균등 분할 금액을 계산해요. 나머지 금액은
                    마지막 회차에 더하며, 이번 회차 금액은 실제 납부액으로
                    수정할 수 있어요.
                  </p>
                  <p className="form-hint">
                    이번 회차만 지출에 반영해요. 미래 회차는 자동으로 기록하지
                    않아요.
                  </p>
                </>
              )}
            </div>
          )}
          <label className="form-label">
            메모 <span className="optional">선택</span>
            <textarea
              value={input.memo}
              onChange={(event) => update("memo", event.target.value)}
              maxLength={500}
              placeholder="기억해두고 싶은 이야기가 있나요?"
              rows={2}
            />
          </label>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {isDemo && (
          <p className="form-hint">이 기기의 기록은 이 브라우저에 저장돼요.</p>
        )}
        {confirmDelete ? (
          <div className="delete-confirm">
            <p>이 기록을 지울까요? 삭제 후에는 되돌릴 수 없어요.</p>
            <div>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={remove}
              >
                {busy ? "삭제 중…" : "기록 삭제"}
              </button>
            </div>
          </div>
        ) : (
          <div className="form-actions">
            {entry ? (
              <button
                type="button"
                className="text-button delete-button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                <Trash2 size={16} />
                삭제
              </button>
            ) : (
              <span />
            )}
            <button className="button primary" type="submit" disabled={busy}>
              {busy ? "저장 중…" : entry ? "수정하기" : "기록하기"}
              {entry ? <Check size={16} /> : <ArrowRight size={16} />}
            </button>
          </div>
        )}
      </form>
      {otherEditor && (
        <Modal
          title="기타 분류 입력"
          description="어떤 수입이나 지출인지 이름을 붙여주세요."
          onClose={() => setOtherEditor(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const text = otherEditor.text.trim();
              if (!text || text.length > 40) {
                setOtherError("분류 이름을 1~40자로 입력해주세요.");
                return;
              }
              setInput((old) => ({
                ...old,
                category: otherEditor.category,
                custom_category: text,
              }));
              setOtherEditor(null);
            }}
          >
            <label className="form-label">
              분류 이름
              <input
                aria-label="기타 분류 이름"
                autoFocus
                maxLength={40}
                value={otherEditor.text}
                placeholder="예: 경조사, 반려동물, 환급금"
                onChange={(event) =>
                  setOtherEditor({ ...otherEditor, text: event.target.value })
                }
              />
            </label>
            {otherError && (
              <p className="form-error" role="alert">
                {otherError}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setOtherEditor(null)}
              >
                취소
              </button>
              <button type="submit" className="button primary">
                적용
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
}
