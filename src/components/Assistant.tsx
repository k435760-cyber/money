import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import type { Book, EntryInput } from "../lib/book";
import { categoryLabel, money, monthLabel } from "../lib/book";
import {
  askAssistant,
  isDuplicateDraft,
  prepareAiImage,
} from "../lib/assistant";
import type { AiDraft, AiImage, AiMessage, AiReply } from "../lib/assistant";
import { Modal } from "./Modal";
import { EntryForm } from "./EntryForm";
import type { AgeGroup } from "../lib/age";

const icon = `${import.meta.env.BASE_URL}ai-icon.png`;
export function Assistant({
  book,
  month,
  isDemo,
  ageGroup,
  onAgeSettings,
  onSave,
  onBudget,
  onClose,
}: {
  book: Book;
  month: string;
  isDemo: boolean;
  ageGroup: AgeGroup;
  onAgeSettings: () => void;
  onSave: (input: EntryInput) => Promise<void>;
  onBudget: () => void;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<AiImage | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<AiMessage[]>([]);
  const [result, setResult] = useState<AiReply | null>(null);
  const [review, setReview] = useState<AiDraft | null>(null);
  const [saved, setSaved] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (result)
      resultRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
  }, [result]);
  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setImageBusy(true);
    try {
      setImage(await prepareAiImage(file));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "이미지를 읽지 못했어요.",
      );
    } finally {
      setImageBusy(false);
    }
  }
  async function send(event?: FormEvent, prompt?: string) {
    event?.preventDefault();
    const question = (prompt ?? message).trim();
    if (busy || imageBusy || (!question && !image)) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    try {
      const request =
        question ||
        "첨부한 영수증이나 거래내역을 읽어 기록 후보를 만들어주세요.";
      const reply = await askAssistant({
        message: request,
        image,
        book,
        month,
        history,
        signal: abort.signal,
        ageGroup,
      });
      setResult((old) => ({
        ...reply,
        drafts: [
          ...(old?.drafts ?? []),
          ...reply.drafts.filter(
            (draft) =>
              !(old?.drafts ?? []).some(
                (existing) =>
                  existing.input.date === draft.input.date &&
                  existing.input.amount === draft.input.amount &&
                  existing.input.kind === draft.input.kind &&
                  existing.input.title === draft.input.title,
              ),
          ),
        ],
      }));
      setSaved(0);
      setHistory(
        (old) =>
          [
            ...old,
            { role: "user", text: request },
            { role: "model", text: reply.reply },
          ].slice(-6) as AiMessage[],
      );
      setMessage("");
      setImage(null);
    } catch (error) {
      if (!abort.signal.aborted)
        setError(
          error instanceof Error ? error.message : "분석을 마치지 못했어요.",
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <Modal
        title="한푼 소비 도우미"
        description={`${monthLabel(month)} · 잘 쓰고, 나답게 모으기.`}
        className="assistant-modal"
        onClose={onClose}
      >
        <div className="assistant-intro">
          <img src={icon} width="48" height="48" alt="" />
          <div>
            <h3>돈 이야기를 함께 정리해요.</h3>
            <p>영수증은 기록으로, 작은 고민은 실천할 계획으로.</p>
          </div>
        </div>
        <div className="assistant-suggestions" aria-label="추천 질문">
          {[
            "이번 달 소비를 돌아봐줘",
            "내 예산에서 줄일 수 있는 지출은?",
            "충동구매를 줄이는 방법을 알려줘",
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy || imageBusy}
              onClick={() => void send(undefined, prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <form className="assistant-composer" onSubmit={send}>
          <label className="form-label">
            궁금한 점이나 기록할 내용
            <textarea
              aria-label="도우미에게 질문"
              rows={3}
              maxLength={2000}
              value={message}
              disabled={busy}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="오늘 점심 12,000원 현금으로 썼어. 또는 이번 달 지출을 함께 살펴볼까요?"
            />
          </label>
          {image && (
            <div className="assistant-attachment">
              <img src={image.preview} alt="분석할 영수증 미리보기" />
              <span>{image.name}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="첨부 이미지 제거"
                disabled={busy}
                onClick={() => setImage(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <input
            ref={upload}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            onChange={chooseImage}
            disabled={busy || imageBusy}
            aria-label="영수증 이미지 선택"
          />
          <div className="assistant-composer-actions">
            <button
              type="button"
              className="text-button"
              disabled={busy || imageBusy}
              onClick={() => upload.current?.click()}
            >
              <ImagePlus size={17} />
              {imageBusy ? "사진 준비 중…" : "영수증·거래 사진"}
            </button>
            {busy ? (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  controller.current?.abort();
                  setBusy(false);
                }}
              >
                분석 취소
              </button>
            ) : (
              <button
                type="submit"
                className="button primary"
                disabled={imageBusy || (!message.trim() && !image)}
              >
                <ArrowUp size={16} />
                {image ? "사진 분석" : "물어보기"}
              </button>
            )}
          </div>
          <p className="assistant-disclosure">
            질문과 선택한 달의 가계부 요약, 첨부 사진을 Google Gemini로 보내요.
            사진과 대화는 가계부 서버에 보관하지 않아요.
          </p>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <div className="assistant-loading" role="status">
            <LoaderCircle size={18} className="spin" />
            <span>
              {image
                ? "영수증에서 날짜와 금액을 읽고 있어요."
                : "기록과 예산을 살펴보고 있어요."}
            </span>
          </div>
        )}
        {result && (
          <div className="assistant-result" ref={resultRef} aria-live="polite">
            <div className="assistant-answer">
              <div className="assistant-answer-heading">
                <img src={icon} width="26" height="26" alt="" />
                <span>한푼의 제안</span>
              </div>
              <p>{result.reply}</p>
            </div>
            {result.warnings.map((warning, i) => (
              <p className="assistant-warning" key={i}>
                {warning}
              </p>
            ))}
            {saved > 0 && (
              <p className="assistant-saved" role="status">
                <Check size={15} />
                {saved}건을 가계부에 기록했어요.
              </p>
            )}
            {result.drafts.length > 0 && (
              <div className="assistant-drafts">
                <h3>
                  확인하고 기록하기 <span>{result.drafts.length}건</span>
                </h3>
                <p className="form-hint">
                  아직 저장되지 않았어요. 금액과 날짜를 확인한 뒤 기록해주세요.
                </p>
                {result.drafts.map((draft, index) => {
                  const duplicate = isDuplicateDraft(book, draft.input);
                  return (
                    <article className="assistant-draft" key={index}>
                      <div>
                        <strong>{draft.input.title || "내용 확인 필요"}</strong>
                        <span>
                          {draft.input.amount
                            ? `${money(draft.input.amount)}원`
                            : "금액 확인 필요"}
                        </span>
                      </div>
                      <p>
                        {draft.input.date} · {categoryLabel(draft.input)} ·{" "}
                        {draft.input.kind === "income" ? "수입" : "지출"}
                      </p>
                      {draft.issues.map((issue, i) => (
                        <p className="assistant-warning" key={i}>
                          {issue}
                        </p>
                      ))}
                      {duplicate && (
                        <p className="assistant-warning">
                          같은 날짜·내용·금액의 기록이 있어요. 중복인지
                          확인해주세요.
                        </p>
                      )}
                      <div className="assistant-draft-actions">
                        <button
                          type="button"
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            setResult((old) =>
                              old
                                ? {
                                    ...old,
                                    drafts: old.drafts.filter(
                                      (item) => item !== draft,
                                    ),
                                  }
                                : old,
                            )
                          }
                        >
                          <Trash2 size={14} />
                          제외
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busy}
                          onClick={() => setReview(draft)}
                        >
                          <Pencil size={14} />
                          확인·수정 후 기록
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              className="text-button assistant-budget-link"
              disabled={busy}
              onClick={onBudget}
            >
              <Plus size={14} />내 예산 직접 정하기
            </button>
            <p className="assistant-model">
              Gemini 3.5 Flash-Lite · 분석이 틀릴 수 있어요. 실제 내역을
              확인해주세요.
            </p>
          </div>
        )}
      </Modal>
      {review && (
        <EntryForm
          ageGroup={ageGroup}
          onAgeSettings={onAgeSettings}
          initialInput={review.input}
          isDemo={isDemo}
          onSave={async (input) => {
            await onSave(input);
            setSaved((old) => old + 1);
            setResult((old) =>
              old
                ? {
                    ...old,
                    drafts: old.drafts.filter((item) => item !== review),
                  }
                : old,
            );
          }}
          onDelete={async () => {}}
          onClose={() => setReview(null)}
        />
      )}
    </>
  );
}
