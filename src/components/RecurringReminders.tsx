import { Bell, ArrowRight } from "lucide-react";
import { money } from "../lib/book";
import type { EntryInput, Transaction } from "../lib/book";
import { recurringCandidates, recurringInput } from "../lib/recurring";

export function RecurringReminders({
  entries,
  onRecord,
}: {
  entries: Transaction[];
  onRecord: (input: EntryInput) => void;
}) {
  const candidates = recurringCandidates(entries);
  return (
    <section className="panel recurring-panel" aria-label="고정 지출 알림">
      <div className="panel-heading">
        <div>
          <h2>
            <Bell size={17} aria-hidden="true" />
            고정 지출, 미리 챙겨요
          </h2>
          <p>지난 두 달의 반복 결제를 바탕으로 이번 달 일정을 예상했어요.</p>
        </div>
        <span className="count-tag">{candidates.length}건</span>
      </div>
      {candidates.length ? (
        <ul className="recurring-list">
          {candidates.map((candidate) => (
            <li key={candidate.key}>
              <div className="recurring-info">
                <strong>{candidate.source.title}</strong>
                <span>
                  {Number(candidate.dueDate.slice(5, 7))}월{" "}
                  {Number(candidate.dueDate.slice(8))}일 예상 ·{" "}
                  {candidate.daysUntil === 0
                    ? "오늘"
                    : candidate.daysUntil > 0
                      ? `${candidate.daysUntil}일 후`
                      : `예정일 ${-candidate.daysUntil}일 지남`}
                </span>
              </div>
              <div className="recurring-action">
                <span>
                  {money(candidate.source.amount)}
                  <small>원 예상</small>
                </span>
                <button
                  className="text-button"
                  onClick={() => onRecord(recurringInput(candidate))}
                >
                  결제했다면 기록
                  <ArrowRight size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="recurring-empty">
          아직 안내할 반복 결제가 없어요. 두 달 연속 비슷한 날짜·금액으로 한
          번씩 기록되면 이곳에서 알려드려요.
        </p>
      )}
      <p className="recurring-footnote">
        고정 지출 후보예요. 자동으로 기록하거나 지출에 더하지 않아요. 사이트를
        열었을 때만 안내하며, 실제 결제일과 금액을 확인하고 기록해주세요.
      </p>
    </section>
  );
}
