import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Check, Trash2 } from "lucide-react";
import {
  categories,
  expenseCategories,
  incomeCategories,
  localDate,
  MAX_AMOUNT,
  money,
  payments,
  validateEntry,
} from "../lib/book";
import type { EntryInput, Kind, Transaction } from "../lib/book";
import { friendlyError } from "../lib/repository";
import { CategoryIcon } from "./Icons";
import { Modal } from "./Modal";

export function EntryForm({
  entry,
  date,
  isDemo,
  onSave,
  onDelete,
  onClose,
}: {
  entry?: Transaction;
  date?: string;
  isDemo: boolean;
  onSave: (input: EntryInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [input, setInput] = useState<EntryInput>(
    entry ?? {
      date: date ?? localDate(),
      title: "",
      amount: 0,
      kind: "expense",
      category: "food",
      payment: "체크카드",
      memo: "",
    },
  );
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
    }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      validateEntry(input);
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
      <form onSubmit={submit} className="entry-form">
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
            금액
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
            <label className="form-label">
              날짜
              <input
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                value={input.date}
                onChange={(event) => update("date", event.target.value)}
                required
              />
            </label>
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
                  className={input.category === category ? "chosen" : ""}
                  aria-pressed={input.category === category}
                  onClick={() => update("category", category)}
                >
                  <CategoryIcon category={category} size={18} />
                  {categories[category].label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="form-label">
            결제 수단
            <select
              value={input.payment}
              onChange={(event) =>
                update("payment", event.target.value as EntryInput["payment"])
              }
            >
              {payments.map((payment) => (
                <option key={payment}>{payment}</option>
              ))}
            </select>
          </label>
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
    </Modal>
  );
}
