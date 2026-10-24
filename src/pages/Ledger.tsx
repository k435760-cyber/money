import { ChoicePicker } from "../components/Pickers";
import { useDeferredValue, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  NotebookPen,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  categories,
  categoryLabel,
  exportCsv,
  money,
  monthTransactions,
  payments,
  sortedEntries,
  sum,
} from "../lib/book";
import type { Book, Transaction } from "../lib/book";
import { TransactionTable } from "../components/Transactions";

export function Ledger({
  book,
  month,
  onEdit,
  onAdd,
}: {
  book: Book;
  month: string;
  onEdit: (entry: Transaction) => void;
  onAdd: () => void;
}) {
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [payment, setPayment] = useState("all");
  const [page, setPage] = useState(1);
  const search = useDeferredValue(query.trim().toLowerCase());
  const entries = monthTransactions(book.transactions, month);
  const filtered = sortedEntries(
    entries.filter(
      (entry) =>
        (kind === "all" || entry.kind === kind) &&
        (category === "all" || entry.category === category) &&
        (payment === "all" || entry.payment === payment) &&
        (!search ||
          `${entry.title} ${entry.memo} ${categoryLabel(entry)}`
            .toLowerCase()
            .includes(search)),
    ),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15)),
    activePage = Math.min(page, pageCount);
  const hasFilters =
    query || category !== "all" || payment !== "all" || kind !== "all";
  const reset = () => {
    setQuery("");
    setCategory("all");
    setPayment("all");
    setKind("all");
    setPage(1);
  };
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportCsv(filtered)], { type: "text/csv;charset=utf-8;" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `한푼_${month}${hasFilters ? "_검색결과" : ""}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="ledger-page">
      <div className="ledger-totals">
        <div>
          <span>들어온 돈</span>
          <strong className="text-green">
            +{money(sum(entries, "income"))}
            <small>원</small>
          </strong>
        </div>
        <div>
          <span>쓴 돈</span>
          <strong>
            −{money(sum(entries, "expense"))}
            <small>원</small>
          </strong>
        </div>
        <div>
          <span>남은 돈</span>
          <strong>
            {money(sum(entries, "income") - sum(entries, "expense"))}
            <small>원</small>
          </strong>
        </div>
      </div>
      <section className="panel ledger-panel">
        <div className="ledger-toolbar">
          <div className="segmented" aria-label="기록 필터">
            {[
              ["all", "전체"],
              ["expense", "지출"],
              ["income", "수입"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={kind === value ? "selected" : ""}
                aria-pressed={kind === value}
                onClick={() => {
                  setKind(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="button secondary export-button"
            onClick={download}
            disabled={!filtered.length}
          >
            <Download size={15} />
            CSV 내보내기
          </button>
        </div>
        <div className="ledger-filters">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="기록 검색"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="내용이나 메모 검색"
            />
          </div>
          <ChoicePicker
            label="카테고리 필터"
            value={category}
            options={[
              { value: "all", label: "모든 카테고리" },
              ...Object.entries(categories).map(([value, category]) => ({
                value,
                label: category.label,
              })),
            ]}
            onChange={(value) => {
              setCategory(value);
              setPage(1);
            }}
          />
          <ChoicePicker
            label="결제 수단 필터"
            value={payment}
            options={[
              { value: "all", label: "모든 결제 수단" },
              ...payments.map((value) => ({ value, label: value })),
            ]}
            onChange={(value) => {
              setPayment(value);
              setPage(1);
            }}
          />
          {hasFilters && (
            <button className="text-button reset-filter" onClick={reset}>
              <X size={14} />
              초기화
            </button>
          )}
        </div>
        <div className="results-summary">
          <span>
            총 <strong>{filtered.length}</strong>개의 기록
            {hasFilters ? "을 찾았어요." : "이 있어요."}
          </span>
          {hasFilters && (
            <span>
              검색된 지출 <strong>{money(sum(filtered, "expense"))}원</strong>
            </span>
          )}
        </div>
        {filtered.length ? (
          <>
            <TransactionTable
              entries={filtered.slice((activePage - 1) * 15, activePage * 15)}
              onEdit={onEdit}
            />
            <div className="pagination">
              <span>
                {(activePage - 1) * 15 + 1}–
                {Math.min(activePage * 15, filtered.length)} / {filtered.length}
                개
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="이전 페이지"
                  disabled={activePage <= 1}
                  onClick={() => setPage(activePage - 1)}
                >
                  <ArrowLeft size={16} />
                </button>
                <span>
                  {activePage} / {pageCount}
                </span>
                <button
                  className="icon-button"
                  aria-label="다음 페이지"
                  disabled={activePage >= pageCount}
                  onClick={() => setPage(activePage + 1)}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state ledger-empty">
            <NotebookPen size={34} strokeWidth={1.2} />
            <h3>
              {hasFilters ? "일치하는 기록이 없어요." : "아직 기록이 없어요."}
            </h3>
            <p>
              {hasFilters
                ? "다른 단어로 찾거나 필터를 바꿔보세요."
                : "하루의 씀씀이를 한 줄씩 남겨보세요."}
            </p>
            <button
              className="text-button"
              onClick={hasFilters ? reset : onAdd}
            >
              {hasFilters ? (
                "필터 초기화"
              ) : (
                <>
                  <Plus size={15} />첫 기록 남기기
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
