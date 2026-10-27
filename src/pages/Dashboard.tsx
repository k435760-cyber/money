import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CircleArrowDown,
  Leaf,
  NotebookPen,
  Pencil,
  Plus,
} from "lucide-react";
import {
  categories,
  currentMonth,
  daysInMonth,
  expenseCategories,
  money,
  monthTransactions,
  planFor,
  shiftMonth,
  sortedEntries,
  sum,
  totalBudget,
} from "../lib/book";
import type { Book, Transaction } from "../lib/book";
import { CategoryChart, SpendingChart } from "../components/Charts";
import { Sprout } from "../components/Icons";
import { TransactionList } from "../components/Transactions";
import { RecurringReminders } from "../components/RecurringReminders";
import type { EntryInput } from "../lib/book";

export function Dashboard({
  book,
  month,
  onEdit,
  onAdd,
  onLedger,
  onBudget,
  onNote,
  onRecurring,
}: {
  book: Book;
  month: string;
  onEdit: (entry: Transaction) => void;
  onAdd: () => void;
  onLedger: () => void;
  onBudget: () => void;
  onNote: () => void;
  onRecurring: (input: EntryInput) => void;
}) {
  const entries = monthTransactions(book.transactions, month);
  const previous = monthTransactions(book.transactions, shiftMonth(month, -1));
  const expense = sum(entries, "expense"),
    income = sum(entries, "income");
  const plan = planFor(book, month),
    budget = totalBudget(plan),
    remaining = budget - expense;
  const today = new Date().getDate();
  const previousAmount = sum(
    month === currentMonth()
      ? previous.filter((entry) => Number(entry.date.slice(8)) <= today)
      : previous,
    "expense",
  );
  const difference = expense - previousAmount;
  const daysLeft =
    month === currentMonth() ? daysInMonth(month) - today + 1 : 0;
  const dailyAvailable = daysLeft
    ? Math.max(0, Math.floor(remaining / daysLeft))
    : 0;
  const budgetPercent = budget
    ? Math.round((expense / budget) * 100)
    : expense
      ? 100
      : 0;
  const mostUsed = expenseCategories
    .map((category) => ({
      category,
      amount: entries
        .filter((entry) => entry.category === category)
        .reduce((sum, entry) => sum + entry.amount, 0),
    }))
    .sort((a, b) => b.amount - a.amount)[0];

  return (
    <div className="overview-grid">
      <section
        className={`summary-card${expense === 0 ? " empty-spending" : ""}`}
        aria-label="이번 달 요약"
      >
        <div className="summary-spending">
          <span className="eyebrow">
            <span className="tiny-dot" />
            이번 달 쓴 돈
          </span>
          <div className={`hero-amount${expense === 0 ? " hero-empty" : ""}`}>
            {expense === 0 ? (
              "아직 지출 내역이 없습니다."
            ) : (
              <>
                {money(expense)}
                <span>원</span>
              </>
            )}
          </div>
          {expense > 0 && (
            <p className="comparison">
              {previousAmount ? (
                <>
                  <span className={difference <= 0 ? "comparison-good" : ""}>
                    {difference <= 0 ? (
                      <ArrowDownLeft size={14} />
                    ) : (
                      <ArrowUpRight size={14} />
                    )}
                    {money(Math.abs(difference))}원{" "}
                    {difference <= 0 ? "덜 썼어요" : "더 썼어요"}
                  </span>
                  <small>
                    {month === currentMonth()
                      ? "지난달 같은 날보다"
                      : "지난달보다"}
                  </small>
                </>
              ) : (
                <span>나의 소비를 알아가는 중이에요.</span>
              )}
            </p>
          )}
        </div>
        <div className="summary-details">
          <div>
            <span>
              <ArrowDownLeft size={15} />
              들어온 돈
            </span>
            <strong>
              {money(income)}
              <small>원</small>
            </strong>
          </div>
          <div>
            <span>
              <ArrowUpRight size={15} />
              수입 − 지출
            </span>
            <strong>
              {money(income - expense)}
              <small>원</small>
            </strong>
          </div>
        </div>
        <Sprout className="summary-sprout" />
      </section>

      <section className="panel flow-panel">
        <div className="panel-heading">
          <div>
            <h2>이달의 소비 흐름</h2>
            <p>매일의 씀씀이를 한눈에 살펴보세요.</p>
          </div>
          <span className="subtle-label">누적 지출</span>
        </div>
        <div className="line-legend">
          <span>
            <i />
            이번 달
          </span>
          <span className="previous">
            <i />
            지난달
          </span>
        </div>
        <SpendingChart entries={entries} previous={previous} month={month} />
      </section>

      <section className="panel category-panel">
        <div className="panel-heading">
          <h2>어디에 썼을까요?</h2>
          <span className="small-caption">카테고리별</span>
        </div>
        <CategoryChart entries={entries} />
        <div className="category-insight">
          <Leaf size={14} />
          {expense ? (
            <span>
              이번 달은 <strong>{categories[mostUsed.category].label}</strong>에
              가장 많이 썼어요.
            </span>
          ) : (
            <span>기록이 쌓이면 소비 습관이 보여요.</span>
          )}
        </div>
      </section>

      {month === currentMonth() && (
        <RecurringReminders
          entries={book.transactions}
          onRecord={onRecurring}
        />
      )}
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h2>
              차곡차곡 쌓인 기록
              <span className="count-tag">{entries.length}</span>
            </h2>
            <p>사소하지만 소중한 나의 일상.</p>
          </div>
          <button className="text-button" onClick={onLedger}>
            전체 보기
            <ArrowRight size={14} />
          </button>
        </div>
        {entries.length ? (
          <TransactionList
            entries={sortedEntries(entries).slice(0, 5)}
            onEdit={onEdit}
          />
        ) : (
          <div className="empty-state">
            <NotebookPen size={30} strokeWidth={1.2} />
            <h3>아직 쓰이지 않은 한 페이지</h3>
            <p>오늘의 첫 기록을 남겨볼까요?</p>
            <button className="text-button" onClick={onAdd}>
              <Plus size={15} />
              기록하기
            </button>
          </div>
        )}
      </section>

      <div className="overview-side">
        <section className="panel budget-mini">
          <div className="panel-heading">
            <h2>예산, 잘 지키고 있나요?</h2>
            <button
              className="icon-button"
              aria-label="예산 살펴보기"
              onClick={onBudget}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="budget-mini-value">
            <strong>
              {money(Math.abs(remaining))}
              <small>원</small>
            </strong>
            <span>{remaining >= 0 ? "남았어요" : "초과했어요"}</span>
          </div>
          <div
            className={`progress-track ${remaining < 0 ? "over" : ""}`}
            role="progressbar"
            aria-label="월 예산 사용률"
            aria-valuenow={Math.min(100, budgetPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${Math.min(100, budgetPercent)}%` }} />
          </div>
          <div className="budget-mini-meta">
            <span>{budgetPercent}% 사용</span>
            <span>총 {money(budget)}원</span>
          </div>
          {daysLeft > 0 && (
            <p className="daily-hint">
              <CircleArrowDown size={14} />
              하루에 <strong>{money(dailyAvailable)}원</strong> 정도 쓸 수
              있어요.
            </p>
          )}
        </section>

        <section className="note-card">
          <div className="note-heading">
            <span>이달의 마음</span>
            <button
              className="icon-button"
              aria-label="이달의 메모 수정"
              onClick={onNote}
            >
              <Pencil size={15} />
            </button>
          </div>
          <button
            className={`note-body ${!plan.note ? "note-placeholder" : ""}`}
            onClick={onNote}
            aria-label="이달의 메모 수정"
          >
            {plan.note || "이번 달, 어떤 마음으로\n지내고 싶나요?"}
          </button>
          <div className="note-footer">
            <span>A NOTE TO MYSELF</span>
            <span className="note-flower" aria-hidden="true">
              ✳
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
