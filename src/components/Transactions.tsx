import { ArrowUpRight, Pencil } from "lucide-react";
import { categoryLabel, money } from "../lib/book";
import type { Transaction } from "../lib/book";
import { CategoryIcon } from "./Icons";

export function TransactionList({
  entries,
  onEdit,
  showDate = true,
}: {
  entries: Transaction[];
  onEdit: (entry: Transaction) => void;
  showDate?: boolean;
}) {
  return (
    <div className="transaction-list">
      {entries.map((entry) => (
        <button
          className="transaction-row"
          key={entry.id}
          onClick={() => onEdit(entry)}
          aria-label={`${entry.title}, ${entry.kind === "income" ? "수입" : "지출"} ${money(entry.amount)}원 수정`}
        >
          <span className={`category-icon category-${entry.category}`}>
            <CategoryIcon category={entry.category} />
          </span>
          <span className="transaction-info">
            <span className="transaction-title">{entry.title}</span>
            <span className="transaction-meta">
              {showDate && (
                <>
                  {Number(entry.date.slice(5, 7))}.{entry.date.slice(8)}
                  <i />{" "}
                </>
              )}
              {categoryLabel(entry)}
              <i />
              {entry.payment}
              {entry.installment_months && (
                <>
                  {" "}
                  · 할부 {entry.installment_current}/{entry.installment_months}
                  회
                </>
              )}
            </span>
          </span>
          <span
            className={`transaction-amount ${entry.kind === "income" ? "text-green" : ""}`}
          >
            {entry.kind === "income" ? "+" : "−"}
            {money(entry.amount)}
            <small>원</small>
          </span>
          <ArrowUpRight size={15} className="row-arrow" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function TransactionTable({
  entries,
  onEdit,
}: {
  entries: Transaction[];
  onEdit: (entry: Transaction) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="ledger-table">
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">내용</th>
            <th scope="col" className="category-cell">
              카테고리
            </th>
            <th scope="col" className="payment-cell">
              결제 수단
            </th>
            <th scope="col" className="amount-cell">
              금액
            </th>
            <th scope="col">
              <span className="sr-only">수정</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="date-cell">
                {entry.date.slice(5).replace("-", ".")}
              </td>
              <td>
                <button
                  className="entry-title-button"
                  onClick={() => onEdit(entry)}
                >
                  <span
                    className={`category-icon small category-${entry.category}`}
                  >
                    <CategoryIcon category={entry.category} size={17} />
                  </span>
                  <span>
                    {entry.title}
                    {(entry.memo ||
                      entry.custom_category ||
                      entry.installment_months) && (
                      <small>
                        {[
                          entry.custom_category,
                          entry.installment_months
                            ? `할부 ${entry.installment_current}/${entry.installment_months}회`
                            : "",
                          entry.memo,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    )}
                  </span>
                </button>
              </td>
              <td className="category-cell">
                <span className="category-tag">{categoryLabel(entry)}</span>
              </td>
              <td className="payment-cell">
                {entry.payment}
                {entry.installment_months && (
                  <small>
                    {" "}
                    · 할부 {entry.installment_current}/
                    {entry.installment_months}회
                  </small>
                )}
              </td>
              <td
                className={`amount-cell ${entry.kind === "income" ? "text-green" : ""}`}
              >
                {entry.kind === "income" ? "+" : "−"}
                {money(entry.amount)}
                <small>원</small>
              </td>
              <td>
                <button
                  className="icon-button row-edit"
                  aria-label={`${entry.title} 수정`}
                  onClick={() => onEdit(entry)}
                >
                  <Pencil size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
