import { ArrowRight, Leaf, Pencil } from "lucide-react";
import {
  categories,
  expenseCategories,
  money,
  monthTransactions,
  planFor,
  sum,
  totalBudget,
} from "../lib/book";
import type { Book } from "../lib/book";
import { CategoryIcon, Sprout } from "../components/Icons";

export function Budget({
  book,
  month,
  onEdit,
}: {
  book: Book;
  month: string;
  onEdit: () => void;
}) {
  const entries = monthTransactions(book.transactions, month);
  const plan = planFor(book, month),
    budget = totalBudget(plan),
    spent = sum(entries, "expense"),
    remaining = budget - spent;
  const percent = budget ? Math.round((spent / budget) * 100) : spent ? 100 : 0;
  return (
    <div className="budget-page">
      <section className="budget-summary">
        <div>
          <span className="eyebrow">나를 위한 한 달의 약속</span>
          <h2>
            {budget === 0
              ? "나에게 맞는 예산부터."
              : remaining >= 0
                ? "여유 있게, 계획한 만큼."
                : "잠깐, 씀씀이를 돌아볼까요?"}
          </h2>
          <p>
            {budget ? (
              <>
                이번 달은 <strong>{money(budget)}원</strong> 안에서 생활하기로
                했어요.
              </>
            ) : (
              "카테고리별 예산을 정해보세요."
            )}
          </p>
          <button className="text-button" onClick={onEdit}>
            {budget ? "예산 다시 정하기" : "예산 정하기"}
            <Pencil size={14} />
          </button>
        </div>
        <Sprout className="budget-sprout" />
      </section>
      <section className="panel budget-total-panel">
        <div className="budget-total-values">
          <div>
            <span>이번 달 예산</span>
            <strong>
              {money(budget)}
              <small>원</small>
            </strong>
          </div>
          <div>
            <span>지금까지 쓴 돈</span>
            <strong>
              {money(spent)}
              <small>원</small>
            </strong>
          </div>
          <div>
            <span>{remaining >= 0 ? "남은 예산" : "초과한 예산"}</span>
            <strong className={remaining >= 0 ? "text-green" : "text-rust"}>
              {money(Math.abs(remaining))}
              <small>원</small>
            </strong>
          </div>
        </div>
        <div
          className={`progress-track budget-total-track ${remaining < 0 ? "over" : ""}`}
          role="progressbar"
          aria-label="전체 예산 사용률"
          aria-valuenow={Math.min(100, percent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
        <div className="budget-track-label">
          <span>0%</span>
          <strong>{percent}% 사용했어요</strong>
          <span>100%</span>
        </div>
      </section>
      <section className="panel budget-categories">
        <div className="panel-heading">
          <div>
            <h2>어디에, 얼마만큼</h2>
            <p>카테고리별로 정한 예산과 씀씀이예요.</p>
          </div>
          <button className="button secondary" onClick={onEdit}>
            <Pencil size={14} />
            예산 수정
          </button>
        </div>
        <div className="budget-category-list">
          {expenseCategories.map((category) => {
            const amount = entries
              .filter(
                (entry) =>
                  entry.kind === "expense" && entry.category === category,
              )
              .reduce((total, entry) => total + entry.amount, 0);
            const target = plan.budgets[category] ?? 0;
            const rate = target
              ? Math.round((amount / target) * 100)
              : amount
                ? 100
                : 0;
            const over = amount > target;
            return (
              <div
                className={`budget-category-row ${over ? "over" : ""}`}
                key={category}
              >
                <div className="budget-category-name">
                  <span className={`category-icon category-${category}`}>
                    <CategoryIcon category={category} />
                  </span>
                  <div>
                    <strong>{categories[category].label}</strong>
                    <span>
                      {over
                        ? `${money(amount - target)}원 초과`
                        : `${money(target - amount)}원 남음`}
                    </span>
                  </div>
                </div>
                <div className="budget-category-bar">
                  <div>
                    <strong>
                      {money(amount)}
                      <small>원</small>
                    </strong>
                    <span> / {money(target)}원</span>
                  </div>
                  <div
                    className={`progress-track ${over ? "over" : ""}`}
                    role="progressbar"
                    aria-label={`${categories[category].label} 예산 사용률`}
                    aria-valuenow={Math.min(100, rate)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      style={{
                        width: `${Math.min(100, rate)}%`,
                        background: over
                          ? undefined
                          : categories[category].color,
                      }}
                    />
                  </div>
                </div>
                <span className={`budget-rate ${over ? "text-rust" : ""}`}>
                  {rate}%
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <div className="budget-tip">
        <Leaf size={18} />
        <p>예산은 나를 제한하는 규칙보다, 잘 쓰기 위한 작은 기준이에요.</p>
        <button className="text-button" onClick={onEdit}>
          나에게 맞게 조정하기
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
