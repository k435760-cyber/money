import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, Check, LogOut, ShieldCheck } from "lucide-react";
import { signInWithGoogle } from "../lib/supabase";
import { friendlyError } from "../lib/repository";
import { Brand, GoogleIcon, Sprout } from "./Icons";
import { Modal } from "./Modal";

export function AuthModal({
  user,
  onClose,
  onSignOut,
  onPrivacy,
}: {
  user: User | null;
  onClose: () => void;
  onSignOut: () => Promise<void>;
  onPrivacy: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [error, setError] = useState("");
  async function login() {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (error) {
      setError(friendlyError(error));
      setBusy(false);
    }
  }
  async function logout() {
    if (!confirmLogout || busy) return;
    setError("");
    setBusy(true);
    try {
      await onSignOut();
      onClose();
    } catch (error) {
      setError(friendlyError(error));
      setBusy(false);
    }
  }
  return (
    <Modal
      title={user ? "나의 계정" : "한푼과 함께해요"}
      onClose={onClose}
      busy={busy}
      className="auth-modal"
    >
      {user ? (
        <div className="account-content">
          <span className="account-avatar large">
            {(user.user_metadata.full_name || user.email || "나").slice(0, 1)}
          </span>
          <h3>{user.user_metadata.full_name || "나의 가계부"}</h3>
          <p>{user.email}</p>
          <div className="account-connected">
            <Check size={16} />
            Google 계정으로 연결되어 있어요.
          </div>
          <p className="form-hint">
            기록은 내 계정에 저장되어 다른 기기에서도 이어갈 수 있어요.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {confirmLogout ? (
            <div className="delete-confirm">
              <p>로그아웃하시겠어요?</p>
              <div>
                <button
                  className="button secondary"
                  disabled={busy}
                  autoFocus
                  onClick={() => setConfirmLogout(false)}
                >
                  취소
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={logout}
                >
                  <LogOut size={16} />
                  {busy ? "로그아웃 중…" : "로그아웃"}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="button secondary"
              onClick={() => setConfirmLogout(true)}
            >
              <LogOut size={16} />
              로그아웃
            </button>
          )}
        </div>
      ) : (
        <div className="auth-content">
          <Brand small />
          <h3>
            나의 일상을,
            <br />
            차곡차곡.
          </h3>
          <Sprout className="auth-sprout" />
          <p>
            잘 쓰고, 잘 모으는 나만의 생활.
            <br />
            어디서든 나의 기록을 이어가세요.
          </p>
          <button className="google-button" disabled={busy} onClick={login}>
            <GoogleIcon />
            <span>{busy ? "Google로 이동 중…" : "Google로 계속하기"}</span>
            <ArrowRight size={17} />
          </button>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="auth-assurance">
            <ShieldCheck size={14} />
            <span>가계부는 나만 볼 수 있어요.</span>
          </div>
          <p className="auth-policy">
            로그인하면{" "}
            <button className="inline-link" onClick={onPrivacy}>
              개인정보 처리 안내
            </button>
            에 동의하게 됩니다.
          </p>
          <p className="auth-demo-note">
            이 기기의 기록은 계정에 자동으로 옮겨지지 않아요.
          </p>
        </div>
      )}
    </Modal>
  );
}
