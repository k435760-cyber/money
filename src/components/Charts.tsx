import {
  categories,
  daysInMonth,
  expenseCategories,
  money,
  sum,
} from "../lib/book";
import type { Transaction } from "../lib/book";

function scaleLabel(value: number) {
  return value >= 10000
    ? `${Math.round(value / 10000)}만`
    : money(Math.round(value));
}

export function SpendingChart({
  entries,
  previous,
  month,
}: {
  entries: Transaction[];
  previous: Transaction[];
  month: string;
}) {
  const days = daysInMonth(month);
  const values = (rows: Transaction[]) =>
    Array.from({ length: days }, (_, index) =>
      rows
        .filter(
          (row) =>
            Number(row.date.slice(8)) <= index + 1 && row.kind === "expense",
        )
        .reduce((total, row) => total + row.amount, 0),
    );
  const current = values(entries);
  const before = values(previous);
  const max = Math.max(...current, ...before, 100000) * 1.15;
  const width = 560,
    height = 175,
    left = 49,
    right = 13,
    top = 14,
    bottom = 28;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const point = (value: number, index: number) => [
    left + (index / (days - 1)) * plotWidth,
    top + (1 - value / max) * plotHeight,
  ];
  const toPath = (data: number[]) =>
    data
      .map(
        (value, index) =>
          `${index === 0 ? "M" : "L"}${point(value, index).join(",")}`,
      )
      .join(" ");
  const now = new Date();
  const visibleDays =
    month ===
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      ? Math.max(
          now.getDate(),
          ...entries.map((row) => Number(row.date.slice(8))),
        )
      : days;
  const visible = current.slice(0, visibleDays);
  const end = point(visible.at(-1) ?? 0, visible.length - 1);
  return (
    <div className="spending-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${Number(month.slice(5))}월 누적 지출 ${money(sum(entries, "expense"))}원. 점선은 지난달 누적 지출이에요.`}
      >
        {[0, 1, 2, 3].map((index) => {
          const y = top + (index / 3) * plotHeight;
          return (
            <g key={index}>
              <line
                x1={left}
                y1={y}
                x2={width - right}
                y2={y}
                stroke="#e9e9e1"
                strokeDasharray={index === 3 ? "" : "3 4"}
              />
              <text
                x={left - 12}
                y={y + 4}
                textAnchor="end"
                className="chart-label"
              >
                {scaleLabel(max * (1 - index / 3))}
              </text>
            </g>
          );
        })}
        <path
          d={toPath(before)}
          fill="none"
          stroke="#c7cbbd"
          strokeWidth="2"
          strokeDasharray="5 5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`${toPath(visible)} L${end[0]},${height - bottom} L${left},${height - bottom} Z`}
          fill="#eff2e8"
          fillOpacity=".8"
        />
        <path
          d={toPath(visible)}
          fill="none"
          stroke="#65784b"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={end[0]}
          cy={end[1]}
          r="4"
          fill="#65784b"
          stroke="#fff"
          strokeWidth="2"
        />
        {[1, 5, 10, 15, 20, 25, days]
          .filter(
            (day, index, values) =>
              values.indexOf(day) === index && day <= days,
          )
          .map((day) => (
            <text
              key={day}
              x={point(0, day - 1)[0]}
              y={height - 4}
              textAnchor="middle"
              className="chart-label"
            >
              {day}일
            </text>
          ))}
        {visible.map((value, index) => (
          <circle
            key={index}
            cx={point(value, index)[0]}
            cy={point(value, index)[1]}
            r="6"
            fill="transparent"
          >
            <title>
              {index + 1}일 누적 {money(value)}원
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export function CategoryChart({ entries }: { entries: Transaction[] }) {
  const total = sum(entries, "expense");
  const breakdown = expenseCategories
    .map((category) => ({
      category,
      amount: entries
        .filter(
          (entry) => entry.kind === "expense" && entry.category === category,
        )
        .reduce((total, entry) => total + entry.amount, 0),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  let offset = 0;
  const circumference = 2 * Math.PI * 48;
  return (
    <div className="category-chart">
      <div className="donut">
        <svg
          viewBox="0 0 124 124"
          role="img"
          aria-label={
            total
              ? breakdown
                  .map(
                    (row) =>
                      `${categories[row.category].label} ${money(row.amount)}원`,
                  )
                  .join(", ")
              : "아직 지출 기록이 없어요"
          }
        >
          <circle
            cx="62"
            cy="62"
            r="48"
            stroke="#eeeee7"
            strokeWidth="13"
            fill="none"
          />
          {breakdown.map((row) => {
            const length = (row.amount / total) * circumference;
            const dashOffset = -offset;
            offset += length;
            return (
              <circle
                key={row.category}
                cx="62"
                cy="62"
                r="48"
                stroke={categories[row.category].color}
                strokeWidth="13"
                fill="none"
                strokeDasharray={`${Math.max(0, length - 3)} ${circumference - Math.max(0, length - 3)}`}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 62 62)"
              />
            );
          })}
        </svg>
        <div className="donut-label">
          <span>가장 많이 쓴</span>
          <strong>
            {breakdown[0]
              ? categories[breakdown[0].category].label
              : "아직 없어요"}
          </strong>
        </div>
      </div>
      <div className="chart-legend">
        {breakdown.length ? (
          breakdown.slice(0, 4).map((row) => (
            <div key={row.category}>
              <span>
                <i style={{ background: categories[row.category].color }} />
                {categories[row.category].label}
              </span>
              <strong>
                {Math.round((row.amount / total) * 100)}
                <small>%</small>
              </strong>
            </div>
          ))
        ) : (
          <p className="muted">첫 기록을 남겨보세요.</p>
        )}
      </div>
    </div>
  );
}
