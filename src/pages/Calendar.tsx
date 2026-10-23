import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  daysInMonth,
  localDate,
  money,
  monthTransactions,
  monthLabel,
  sum,
} from "../lib/book";
import type { Book } from "../lib/book";

const compact = (amount: number) =>
  amount >= 100000000
    ? `${Number((amount / 100000000).toFixed(1))}억`
    : amount >= 10000
      ? `${Number((amount / 10000).toFixed(1))}만`
      : money(amount);
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
  const today = localDate();
  const incomeTotal = sum(entries, "income");
  const expenseTotal = sum(entries, "expense");
  const recordedDays = new Set(entries.map((entry) => entry.date)).size;
  const startDay = new Date(`${month}-01T12:00:00`).getDay();
  const days = daysInMonth(month);
  const cells = Math.ceil((startDay + days) / 7) * 7;
  return (
    <section className="panel calendar-panel">
      <div className="calendar-card-heading">
        <h2>{monthLabel(month)}</h2>
        <span>
          {recordedDays ? `${recordedDays}일의 기록` : "첫 기록을 기다려요"}
        </span>
      </div>
      <div
        className="calendar-summary"
        data-wide={money(Math.max(incomeTotal, expenseTotal)).length > 9}
      >
        <div>
          <span>
            <ArrowDownLeft size={15} />
            들어온 돈
          </span>
          <strong className="text-green">
            +{money(incomeTotal)}
            <small>원</small>
          </strong>
        </div>
        <div>
          <span>
            <ArrowUpRight size={15} />쓴 돈
          </span>
          <strong>
            −{money(expenseTotal)}
            <small>원</small>
          </strong>
        </div>
      </div>
      <p className="calendar-instruction">
        날짜를 눌러 그날의 기록을 확인해보세요.
      </p>
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
            return (
              <div
                className="calendar-cell empty"
                aria-hidden="true"
                key={index}
              />
            );
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const rows = entries.filter((entry) => entry.date === date);
          const income = sum(rows, "income"),
            expense = sum(rows, "expense");
          return (
            <button
              key={index}
              className={`calendar-cell ${today === date ? "today" : ""} ${rows.length ? "has-records" : ""} ${index % 7 === 0 ? "sunday" : index % 7 === 6 ? "saturday" : ""}`}
              disabled={date > today && rows.length === 0}
              aria-current={today === date ? "date" : undefined}
              onClick={() => onDay(date)}
              aria-label={`${Number(month.slice(5))}월 ${day}일, 기록 ${rows.length}개${expense ? `, 지출 ${money(expense)}원` : ""}${income ? `, 수입 ${money(income)}원` : ""}`}
            >
              <span className="day-number">{day}</span>
              <span className="day-amounts">
                {income > 0 && (
                  <span
                    className="day-income"
                    title={`수입 ${money(income)}원`}
                  >
                    +{compact(income)}
                  </span>
                )}
                {expense > 0 && (
                  <span
                    className="day-expense"
                    title={`지출 ${money(expense)}원`}
                  >
                    −{compact(expense)}
                  </span>
                )}
              </span>
              {rows.length > 0 && (
                <span className="day-count">{rows.length}건</span>
              )}
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
          <i className="today-dot" /> 오늘
        </span>
      </div>
    </section>
  );
}
