import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  daysInMonth,
  localDate,
  money,
  monthTransactions,
  sum,
} from "../lib/book";
import type { Book } from "../lib/book";

const compact = (amount: number) =>
  amount >= 100000 ? `${Number((amount / 10000).toFixed(1))}만` : money(amount);
export function Calendar({
  book,
  month,
  onDay,
}: {
  book: Book;
  month: string;
  onDay: (date: string) => void;
}) {
  const entries = monthTransactions(book.transactions, month);
  const startDay = new Date(`${month}-01T12:00:00`).getDay();
  const days = daysInMonth(month);
  const cells = Math.ceil((startDay + days) / 7) * 7;
  return (
    <section className="panel calendar-panel">
      <div className="calendar-summary">
        <div>
          <span>
            <ArrowDownLeft size={15} />
            들어온 돈
          </span>
          <strong className="text-green">
            +{money(sum(entries, "income"))}
            <small>원</small>
          </strong>
        </div>
        <div>
          <span>
            <ArrowUpRight size={15} />쓴 돈
          </span>
          <strong>
            −{money(sum(entries, "expense"))}
            <small>원</small>
          </strong>
        </div>
        <p>날짜를 누르면 그날의 기록을 볼 수 있어요.</p>
      </div>
      <div
        className="calendar-grid"
        role="group"
        aria-label={`${month} 소비 달력`}
      >
        {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
          <div
            key={day}
            className={`weekday ${index === 0 ? "sunday" : index === 6 ? "saturday" : ""}`}
          >
            {day}
          </div>
        ))}
        {Array.from({ length: cells }, (_, index) => {
          const day = index - startDay + 1;
          if (day < 1 || day > days)
            return <div className="calendar-cell empty" key={index} />;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const rows = entries.filter((entry) => entry.date === date);
          const income = sum(rows, "income"),
            expense = sum(rows, "expense");
          return (
            <button
              key={index}
              className={`calendar-cell ${localDate() === date ? "today" : ""} ${index % 7 === 0 ? "sunday" : index % 7 === 6 ? "saturday" : ""}`}
              onClick={() => onDay(date)}
              aria-label={`${Number(month.slice(5))}월 ${day}일, 기록 ${rows.length}개${expense ? `, 지출 ${money(expense)}원` : ""}${income ? `, 수입 ${money(income)}원` : ""}`}
            >
              <span className="day-number">{day}</span>
              <span className="day-amounts">
                {income > 0 && (
                  <span className="text-green">+{compact(income)}</span>
                )}
                {expense > 0 && <span>−{compact(expense)}</span>}
              </span>
              {rows.length > 0 && (
                <span className="day-count">{rows.length}건</span>
              )}
              <span className="day-add" aria-hidden="true">
                +
              </span>
            </button>
          );
        })}
      </div>
      <div className="calendar-key">
        <span>
          <i className="green-dot" />
          수입
        </span>
        <span>
          <i className="brown-dot" />
          지출
        </span>
        <span className="calendar-today-label">
          동그라미 표시는 오늘이에요.
        </span>
      </div>
    </section>
  );
}
