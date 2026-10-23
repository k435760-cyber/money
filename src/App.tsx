import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Leaf,
  LoaderCircle,
  LogIn,
  NotebookPen,
  Plus,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react";
import { useLedger } from "./hooks/useLedger";
import {
  currentMonth,
  dateLabel,
  localDate,
  money,
  monthLabel,
  planFor,
  shiftMonth,
  sortedEntries,
  sum,
} from "./lib/book";
import type { EntryInput, Plan, Transaction } from "./lib/book";
import { Brand } from "./components/Icons";
import { Modal } from "./components/Modal";
import { EntryForm } from "./components/EntryForm";
import { PlanForm } from "./components/PlanForm";
import { DatePicker } from "./components/Pickers";
import { AuthModal } from "./components/AuthModal";
import { TransactionList } from "./components/Transactions";
import { Dashboard } from "./pages/Dashboard";

const Assistant = lazy(() =>
  import("./components/Assistant").then((module) => ({
    default: module.Assistant,
  })),
);

const Ledger = lazy(() =>
  import("./pages/Ledger").then((module) => ({ default: module.Ledger })),
);
const Calendar = lazy(() =>
  import("./pages/Calendar").then((module) => ({ default: module.Calendar })),
);
const Budget = lazy(() =>
  import("./pages/Budget").then((module) => ({ default: module.Budget })),
);

type View = "overview" | "ledger" | "calendar" | "budget";
const navigation = [
  { id: "overview", label: "한눈에 보기", icon: ChartNoAxesCombined },
  { id: "ledger", label: "나의 가계부", icon: BookOpen },
  { id: "calendar", label: "소비 달력", icon: CalendarDays },
  { id: "budget", label: "예산 관리", icon: Wallet },
] as const;

export default function App() {
  const ledger = useLedger();
  const [view, setView] = useState<View>("overview");
  const [month, setMonth] = useState(currentMonth);
  const [editor, setEditor] = useState<{
    entry?: Transaction;
    date?: string;
  } | null>(null);
  const [planEditor, setPlanEditor] = useState<"budget" | "note" | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(
    null,
  );
  const isDemo = !ledger.user;
  const monthNumber = Number(month.slice(5));
  const heading = {
    overview: `나의 ${monthNumber}월, 차곡차곡.`,
    ledger: "일상을 적는 가계부.",
    calendar: "기록으로 채운 달력.",
    budget: "계획하는 작은 여유.",
  }[view];
  const subtitle = {
    overview: "작은 기록이 모여, 조금 더 단단한 일상.",
    ledger: "잘 쓴 돈도, 아쉬운 소비도 나를 알아가는 기록이에요.",
    calendar: "하루하루의 씀씀이가 모여 한 달의 이야기가 돼요.",
    budget: "내가 소중하게 생각하는 곳에, 알맞게 쓰기.",
  }[view];

  useEffect(() => {
    document.title = `한푼 — ${monthLabel(month)} ${navigation.find((item) => item.id === view)?.label}`;
  }, [view, month]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const notify = (text: string) => setToast({ text, key: Date.now() });
  const addEntry = () =>
    setEditor({ date: month >= currentMonth() ? localDate() : `${month}-01` });
  const editEntry = (entry: Transaction) => {
    setDay(null);
    setEditor({ entry });
  };
  async function saveEntry(input: EntryInput, id?: string) {
    await ledger.saveEntry(input, id);
    setMonth(input.date.slice(0, 7));
    notify(
      id
        ? "기록을 수정했어요."
        : isDemo
          ? "이 기기 가계부에 기록을 남겼어요."
          : "오늘의 기록을 남겼어요.",
    );
  }
  async function savePlan(plan: Plan) {
    await ledger.savePlan(plan);
    notify(
      planEditor === "note"
        ? "이달의 마음을 남겼어요."
        : "이달의 예산을 정했어요.",
    );
  }
  const dayEntries = day
    ? sortedEntries(
        ledger.book.transactions.filter((entry) => entry.date === day),
      )
    : [];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 바로가기
      </a>
      <aside className="sidebar">
        <button
          className="brand-button"
          onClick={() => setView("overview")}
          aria-label="한푼 홈"
        >
          <Brand />
        </button>
        <p className="brand-description">매일의 작은 기록</p>
        <div className="sidebar-line" />
        <span className="nav-caption">MY JOURNAL</span>
        <nav className="main-nav" aria-label="주요 메뉴">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              <item.icon size={19} strokeWidth={1.65} />
              <span>{item.label}</span>
              {view === item.id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Leaf size={21} strokeWidth={1.2} />
          <p>
            잘 쓰고, 잘 모으는
            <br />
            나만의 생활.
          </p>
          <span>A LITTLE, EVERY DAY.</span>
        </div>
        <div className="sidebar-bottom">
          <button className="sidebar-help" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={16} />
            한푼 사용하기
            <ArrowRight size={14} />
          </button>
          <div className="account-divider" />
          <button className="account-button" onClick={() => setAuthOpen(true)}>
            <span className={`account-avatar ${isDemo ? "demo-avatar" : ""}`}>
              {isDemo ? (
                <LogIn size={18} strokeWidth={1.7} />
              ) : (
                (
                  ledger.user?.user_metadata.full_name ||
                  ledger.user?.email ||
                  "나"
                ).slice(0, 1)
              )}
            </span>
            <span>
              <strong>
                {isDemo
                  ? "나의 기록 시작하기"
                  : ledger.user?.user_metadata.full_name || "나의 가계부"}
              </strong>
              <small>{isDemo ? "Google로 로그인" : "Google 계정 연결됨"}</small>
            </span>
            <ChevronRight size={15} />
          </button>
          <button className="privacy-link" onClick={() => setPrivacyOpen(true)}>
            개인정보 처리 안내
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand small />
          </div>
          <span className="topbar-label">YOUR EVERYDAY, WELL SPENT.</span>
          <div className="topbar-right">
            <button
              className="assistant-launch"
              disabled={!ledger.ready}
              onClick={() => setAssistantOpen(true)}
              aria-label="소비 도우미 열기"
            >
              <img
                src={`${import.meta.env.BASE_URL}ai-icon.png`}
                alt=""
                width="25"
                height="25"
              />
              <span>소비 도우미</span>
            </button>
            <button className="mode-badge" onClick={() => setAuthOpen(true)}>
              <span className="tiny-dot" />
              {isDemo ? "이 기기 가계부" : "나의 가계부"}
              <ChevronRight size={12} />
            </button>
            <span className="topbar-date">
              {new Date().toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                <span className="small-leaf">
                  <Leaf size={14} />
                </span>
                {view === "overview"
                  ? "오늘도, 나를 위한 한 페이지"
                  : navigation.find((item) => item.id === view)?.label}
              </div>
              <h1>{heading}</h1>
              <p>{subtitle}</p>
            </div>
            <button
              className="button primary add-button"
              onClick={addEntry}
              disabled={!ledger.ready}
            >
              <Plus size={17} strokeWidth={1.8} />
              기록하기
            </button>
          </div>
          <div className="month-toolbar">
            <div className="month-navigation">
              <button
                className="icon-button"
                aria-label="이전 달"
                disabled={month <= "1900-01"}
                onClick={() => setMonth(shiftMonth(month, -1))}
              >
                <ChevronLeft size={17} />
              </button>
              <DatePicker
                mode="month"
                label="조회 월"
                value={month}
                onChange={setMonth}
              />
              <button
                className="icon-button"
                aria-label="다음 달"
                disabled={month >= "2100-12"}
                onClick={() => setMonth(shiftMonth(month, 1))}
              >
                <ChevronRight size={17} />
              </button>
              {month !== currentMonth() && (
                <button
                  className="today-button"
                  onClick={() => setMonth(currentMonth())}
                >
                  이번 달
                </button>
              )}
            </div>
            <span className="month-toolbar-note">
              {isDemo ? (
                <>
                  <span className="tiny-dot" />이 기기의 기록은 이 브라우저에
                  저장돼요.
                </>
              ) : (
                <>
                  <Check size={13} />내 계정에 안전하게 저장돼요.
                </>
              )}
            </span>
          </div>
          {ledger.error && (
            <div className="error-banner" role="alert">
              <span>{ledger.error}</span>
              <button className="text-button" onClick={ledger.refresh}>
                <RefreshCw size={14} />
                다시 시도
              </button>
              <button
                className="icon-button"
                aria-label="알림 닫기"
                onClick={() => ledger.setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {ledger.loading ? (
            <div className="loading-state" role="status">
              <LoaderCircle size={24} className="spin" />
              <p>나의 기록을 펼치는 중이에요.</p>
            </div>
          ) : !ledger.ready ? (
            <div className="empty-state load-error">
              <NotebookPen size={34} strokeWidth={1.2} />
              <h2>가계부를 불러오지 못했어요.</h2>
              <p>연결 상태를 확인하고 다시 펼쳐주세요.</p>
              <button className="button secondary" onClick={ledger.refresh}>
                <RefreshCw size={16} />
                다시 불러오기
              </button>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="loading-state" role="status">
                  <LoaderCircle size={24} className="spin" />
                  <p>페이지를 펼치는 중이에요.</p>
                </div>
              }
            >
              <div className="view-content" key={`${view}-${month}`}>
                {view === "overview" && (
                  <Dashboard
                    book={ledger.book}
                    month={month}
                    onEdit={editEntry}
                    onAdd={addEntry}
                    onLedger={() => setView("ledger")}
                    onBudget={() => setView("budget")}
                    onNote={() => setPlanEditor("note")}
                  />
                )}
                {view === "ledger" && (
                  <Ledger
                    book={ledger.book}
                    month={month}
                    onEdit={editEntry}
                    onAdd={addEntry}
                  />
                )}
                {view === "calendar" && (
                  <Calendar book={ledger.book} month={month} onDay={setDay} />
                )}
                {view === "budget" && (
                  <Budget
                    book={ledger.book}
                    month={month}
                    onEdit={() => setPlanEditor("budget")}
                  />
                )}
              </div>
            </Suspense>
          )}
          <footer className="main-footer">
            <span>한푼씩, 나다운 일상.</span>
            <span>MADE FOR YOUR EVERYDAY</span>
          </footer>
        </main>
      </div>
      {assistantOpen && (
        <Suspense
          fallback={
            <Modal title="소비 도우미" onClose={() => setAssistantOpen(false)}>
              <p role="status">도우미를 불러오고 있어요.</p>
            </Modal>
          }
        >
          <Assistant
            key={ledger.user?.id || "guest"}
            book={ledger.book}
            month={month}
            isDemo={isDemo}
            onSave={(input) => saveEntry(input)}
            onBudget={() => setPlanEditor("budget")}
            onClose={() => setAssistantOpen(false)}
          />
        </Suspense>
      )}
      {editor && (
        <EntryForm
          key={editor.entry?.id || editor.date}
          entry={editor.entry}
          date={editor.date}
          isDemo={isDemo}
          onSave={saveEntry}
          onDelete={async (id) => {
            await ledger.deleteEntry(id);
            notify("기록을 삭제했어요.");
          }}
          onClose={() => setEditor(null)}
        />
      )}
      {planEditor && (
        <PlanForm
          plan={planFor(ledger.book, month)}
          mode={planEditor}
          onSave={savePlan}
          onClose={() => setPlanEditor(null)}
        />
      )}
      {authOpen && (
        <AuthModal
          user={ledger.user}
          onClose={() => setAuthOpen(false)}
          onSignOut={async () => {
            await ledger.signOut();
            notify("로그아웃했어요.");
          }}
          onPrivacy={() => {
            setAuthOpen(false);
            setPrivacyOpen(true);
          }}
        />
      )}
      {day && (
        <Modal
          title={dateLabel(day)}
          description={`${dayEntries.length}개의 작은 기록`}
          onClose={() => setDay(null)}
        >
          <div className="day-modal-content">
            {dayEntries.length ? (
              <>
                <div className="day-totals">
                  <span>
                    수입{" "}
                    <strong className="text-green">
                      +{money(sum(dayEntries, "income"))}원
                    </strong>
                  </span>
                  <span>
                    지출 <strong>−{money(sum(dayEntries, "expense"))}원</strong>
                  </span>
                </div>
                <TransactionList
                  entries={dayEntries}
                  onEdit={editEntry}
                  showDate={false}
                />
              </>
            ) : (
              <div className="empty-state">
                <NotebookPen size={30} strokeWidth={1.2} />
                <p>이날의 첫 기록을 남겨보세요.</p>
              </div>
            )}
            <button
              className="button primary full-width"
              disabled={day > localDate()}
              onClick={() => {
                setEditor({ date: day });
                setDay(null);
              }}
            >
              <Plus size={16} />
              {day > localDate()
                ? "미래 날짜에는 기록할 수 없어요"
                : "이날 기록하기"}
            </button>
          </div>
        </Modal>
      )}
      {privacyOpen && (
        <Modal title="개인정보 처리 안내" onClose={() => setPrivacyOpen(false)}>
          <div className="prose-content">
            <p>한푼은 나만의 가계부를 기록하기 위한 서비스예요.</p>
            <h3>어떤 정보를 보관하나요?</h3>
            <p>
              Google 로그인 시 이름, 이메일, 프로필 정보를 Supabase Auth에서
              처리해요. 입력한 수입·지출, 예산, 메모는 선택한 Supabase
              프로젝트에 계정별로 보관해요.
            </p>
            <h3>누가 기록을 볼 수 있나요?</h3>
            <p>
              가계부 데이터는 본인 계정에서만 조회·수정하도록 접근 규칙을
              적용했어요. 별도의 광고나 방문 분석 도구는 사용하지 않아요.
            </p>
            <h3>브라우저에는 무엇이 남나요?</h3>
            <p>
              로그인 세션과 이 기기의 기록을 브라우저 저장 공간에 보관해요. 이
              기기의 기록은 계정으로 자동 전송되지 않으며, 브라우저 데이터를
              지우면 사라질 수 있어요.
            </p>
            <h3>소비 도우미와 사진 분석</h3>
            <p>
              도우미를 실행하면 질문, 선택한 달의 가계부 요약과 최근 기록의
              날짜·내용·금액, 첨부한 이미지를 Google Gemini에 보내 분석해요.
              계정 이메일과 기록 메모는 요약에 포함하지 않아요. 사진과 대화는
              한푼 서버에 저장하지 않으며, 분석된 기록은 본인이 확인하고 저장한
              뒤 가계부에 반영돼요. 이용량 관리에는 계정 식별자 또는 복원할 수
              없는 IP 해시와 요청 횟수를 최대 3일 보관해요.
            </p>
            <h3>보관과 삭제</h3>
            <p>
              입력한 기록과 메모는 가계부에서 직접 수정·삭제할 수 있어요. Google
              인증 계정이 삭제되면 연결된 가계부 데이터도 함께 삭제돼요. 공용
              기기에서는 사용 후 로그아웃해주세요.
            </p>
            <p className="muted">
              인증 제공: Google · 데이터 및 인증 보관: Supabase
              <br />
              시행일: 2026년 10월 23일
            </p>
          </div>
        </Modal>
      )}
      {helpOpen && (
        <Modal
          title="처음 만나는 한푼"
          description="매일 조금씩, 나다운 속도로 기록하세요."
          onClose={() => setHelpOpen(false)}
        >
          <div className="prose-content help-content">
            <div>
              <span>01</span>
              <section>
                <h3>오늘의 기록 남기기</h3>
                <p>
                  ‘기록하기’에서 금액과 내용을 적어주세요. 이미 쓴 기록은 누르면
                  수정하거나 삭제할 수 있어요.
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>나에게 맞는 예산 정하기</h3>
                <p>
                  ‘예산 관리’에서 카테고리별 한도를 정해요. 처음에는 예산이
                  설정되어 있지 않으며, 원하는 금액으로 바꿀 수 있어요.
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>내 기록은 내가 가지고 있기</h3>
                <p>
                  ‘나의 가계부’에서 월별 내역을 CSV로 내보낼 수 있어요. 검색이나
                  필터를 적용하면 해당 내역만 내보내요.
                </p>
              </section>
            </div>
            <div>
              <span>04</span>
              <section>
                <h3>어디서든 이어서 쓰기</h3>
                <p>
                  Google로 로그인하면 내 계정에 저장돼요. 이 기기 가계부는
                  별도로 보관되며 계정에 자동으로 합쳐지지 않아요.
                </p>
              </section>
            </div>
            <button
              className="button primary full-width"
              onClick={() => setHelpOpen(false)}
            >
              차곡차곡 시작하기
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className="toast" key={toast.key}>
            <Check size={16} />
            {toast.text}
            <button
              className="icon-button"
              onClick={() => setToast(null)}
              aria-label="알림 닫기"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
