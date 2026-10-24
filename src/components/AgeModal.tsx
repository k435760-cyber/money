import { useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { assessFaceAge, prepareAiImage } from "../lib/assistant";
import type { AiImage } from "../lib/assistant";
import { friendlyError } from "../lib/repository";
import { Modal } from "./Modal";

export function AgeModal({
  onAssessed,
  onClose,
}: {
  onAssessed: () => Promise<void>;
  onClose: () => void;
}) {
  const [image, setImage] = useState<AiImage | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  return (
    <Modal
      title="얼굴 사진으로 연령대 확인"
      description="AI 추정으로 일부 기능의 이용 범위를 정해요."
      onClose={onClose}
      busy={busy}
      className="age-modal"
    >
      <form
        className="age-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!image || !consent || busy) return;
          setBusy(true);
          setError("");
          setResult("");
          const abort = new AbortController();
          controller.current = abort;
          try {
            const reply = await assessFaceAge(image, abort.signal);
            await onAssessed();
            setImage(null);
            setConsent(false);
            setResult(reply.message);
          } catch (error) {
            if (!abort.signal.aborted) setError(friendlyError(error));
          } finally {
            if (!abort.signal.aborted) setBusy(false);
          }
        }}
      >
        <div className="age-notice">
          <p>
            사진으로 실제 만 나이를 정확히 확인할 수는 없어요. 만 14세 미만으로
            추정되거나 판정이 불확실하면 할부·보험 입력을 제한해요. 일반
            수입·지출 기록은 계속 이용할 수 있어요.
          </p>
        </div>
        <p className="form-hint">
          다른 사람 없이 본인 얼굴이 정면으로 선명하게 나온 사진을 골라주세요.
          신분증·다른 사람의 사진은 올리지 마세요. 사진은 한푼 서버에 저장하지
          않으며, 얼굴 식별 정보나 얼굴 특징값을 만들거나 저장하지 않아요.
        </p>
        {image && (
          <img
            className="age-photo-preview"
            src={image.preview}
            alt="분석할 얼굴 사진 미리보기"
          />
        )}
        <label className="age-upload">
          <Camera size={18} />
          <span>
            {preparing
              ? "사진을 준비하는 중…"
              : image
                ? "다른 사진 선택"
                : "사진 촬영 또는 선택"}
          </span>
          <input
            aria-label="연령대 확인용 얼굴 사진"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            disabled={busy || preparing}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setPreparing(true);
              setConsent(false);
              setError("");
              setResult("");
              try {
                setImage(await prepareAiImage(file));
              } catch (error) {
                setError(friendlyError(error));
              } finally {
                setPreparing(false);
              }
            }}
          />
        </label>
        <label className="age-consent">
          <input
            type="checkbox"
            checked={consent}
            disabled={busy}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>
            제 얼굴 사진을 Google Gemini에 전송해 연령대를 추정하는 데
            동의합니다. Google의 API 처리·보관 정책이 적용되며, 한푼에는 판정
            결과·동의 시각·30일 유효기간만 저장됩니다.
          </span>
        </label>
        <p className="form-hint">
          AI 추정은 신원·생년월일 인증이나 법정대리인 동의 확인이 아니에요.
          판정에 오류가 있을 수 있으며, 30일 후에는 다시 확인해요. 분석에는
          인터넷이 필요하고 AI 일일 이용 한도가 함께 적용돼요.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <p className="age-result" role="status">
            {result}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            닫기
          </button>
          <button
            className="button primary"
            disabled={busy || preparing || !image || !consent}
          >
            {busy ? (
              <>
                <LoaderCircle size={16} className="spin" />
                확인 중…
              </>
            ) : (
              "AI로 연령대 확인"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
