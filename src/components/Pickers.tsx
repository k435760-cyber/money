import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  currentMonth,
  daysInMonth,
  localDate,
  monthLabel,
  shiftMonth,
} from "../lib/book";
import { Modal } from "./Modal";

export function ChoicePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="picker-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>{options.find((option) => option.value === value)?.label}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <Modal
          title={label}
          className="picker-modal"
          onClose={() => setOpen(false)}
        >
          <div className="picker-options" role="group" aria-label={label}>
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                autoFocus={option.value === value}
                aria-pressed={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <Check size={17} />}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

export function DatePicker({
  value,
  onChange,
  mode = "date",
  label = "날짜",
}: {
  value: string;
  onChange: (value: string) => void;
  mode?: "date" | "month";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`picker-trigger ${mode === "month" ? "month-picker" : "date-picker-trigger"}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>
          {monthLabel(value.slice(0, 7))}
          {mode === "date" ? ` ${Number(value.slice(8))}일` : ""}
        </span>
        {mode === "date" ? (
          <CalendarDays size={16} />
        ) : (
          <ChevronDown size={14} />
        )}
      </button>
      {open && (
        <CalendarPicker
          value={value}
          mode={mode}
          onClose={() => setOpen(false)}
          onChange={(value) => {
            onChange(value);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function CalendarPicker({
  value,
  mode,
  onChange,
  onClose,
}: {
  value: string;
  mode: "date" | "month";
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const today = localDate();
  const maxMonth = mode === "date" ? today.slice(0, 7) : "2100-12";
  const maxYear = Number(maxMonth.slice(0, 4));
  const [month, setMonth] = useState(
    value.slice(0, 7) > maxMonth ? maxMonth : value.slice(0, 7),
  );
  const [monthsOpen, setMonthsOpen] = useState(mode === "month");
  const [yearText, setYearText] = useState(month.slice(0, 4));
  const [cursor, setCursor] = useState(
    value.length === 10 && value <= today ? value : `${month}-01`,
  );
  const keyboardFocus = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const year = Number(month.slice(0, 4));
  const offset = new Date(year, Number(month.slice(5)) - 1, 1).getDay();
  function moveMonth(next: string) {
    const bounded = next > maxMonth ? maxMonth : next;
    setMonth(bounded);
    setYearText(bounded.slice(0, 4));
  }
  useEffect(() => {
    if (keyboardFocus.current) {
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)
        ?.focus();
      keyboardFocus.current = false;
    }
  }, [cursor, month]);
  return (
    <Modal
      title={mode === "month" ? "조회 월 선택" : "날짜 선택"}
      className="picker-modal calendar-picker-modal"
      onClose={onClose}
    >
      <div className="picker-calendar">
        {mode === "date" && (
          <p className="picker-date-hint">
            오늘까지의 날짜만 기록할 수 있어요.
          </p>
        )}
        <div className="picker-year">
          <label>
            연도{" "}
            <input
              aria-label="연도"
              inputMode="numeric"
              value={yearText}
              maxLength={4}
              onChange={(event) => {
                const text = event.target.value;
                if (!/^\d{0,4}$/.test(text)) return;
                setYearText(text);
                if (
                  text.length === 4 &&
                  Number(text) >= 1900 &&
                  Number(text) <= maxYear
                )
                  moveMonth(`${text}-${month.slice(5)}`);
              }}
              onBlur={() => setYearText(month.slice(0, 4))}
            />
          </label>
          <span>1900–{maxYear}년</span>
        </div>
        <div className="picker-calendar-nav">
          <button
            type="button"
            className="icon-button"
            aria-label={monthsOpen ? "이전 해" : "이전 달"}
            disabled={monthsOpen ? year <= 1900 : month <= "1900-01"}
            onClick={() => moveMonth(shiftMonth(month, monthsOpen ? -12 : -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              if (mode === "date") setMonthsOpen(!monthsOpen);
            }}
            aria-expanded={monthsOpen}
          >
            {monthsOpen ? `${year}년` : monthLabel(month)}
            <ChevronDown size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={monthsOpen ? "다음 해" : "다음 달"}
            disabled={monthsOpen ? year >= maxYear : month >= maxMonth}
            onClick={() => moveMonth(shiftMonth(month, monthsOpen ? 12 : 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {monthsOpen ? (
          <div className="picker-month-grid" role="group" aria-label="월 선택">
            {Array.from({ length: 12 }, (_, index) => {
              const next = `${year}-${String(index + 1).padStart(2, "0")}`;
              return (
                <button
                  type="button"
                  key={next}
                  disabled={next > maxMonth}
                  aria-pressed={value.startsWith(next)}
                  onClick={() => {
                    if (mode === "month") onChange(next);
                    else {
                      moveMonth(next);
                      setMonthsOpen(false);
                    }
                  }}
                >
                  {index + 1}월
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div className="picker-weekdays" aria-hidden="true">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div
              className="picker-day-grid"
              role="group"
              aria-label={monthLabel(month)}
              ref={grid}
            >
              {Array.from({ length: offset }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: daysInMonth(month) }, (_, i) => {
                const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <button
                    type="button"
                    key={date}
                    data-date={date}
                    disabled={date > today}
                    aria-label={`${monthLabel(month)} ${i + 1}일`}
                    aria-pressed={value === date}
                    aria-current={date === localDate() ? "date" : undefined}
                    tabIndex={
                      cursor.startsWith(month)
                        ? cursor === date
                          ? 0
                          : -1
                        : i === 0
                          ? 0
                          : -1
                    }
                    onClick={() => onChange(date)}
                    onKeyDown={(event) => {
                      const delta = {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                      }[event.key];
                      if (delta === undefined) return;
                      event.preventDefault();
                      const nextDate = new Date(
                        year,
                        Number(month.slice(5)) - 1,
                        i + 1 + delta,
                      );
                      const next = localDate(nextDate);
                      if (next < "1900-01-01" || next > today) return;
                      keyboardFocus.current = true;
                      setCursor(next);
                      moveMonth(next.slice(0, 7));
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="picker-footer">
          <button
            type="button"
            className="text-button"
            onClick={() =>
              onChange(mode === "month" ? currentMonth() : localDate())
            }
          >
            {mode === "month" ? "이번 달 선택" : "오늘 선택"}
          </button>
          <button type="button" className="button secondary" onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </Modal>
  );
}
