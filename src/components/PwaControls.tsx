import { useEffect, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { Modal } from "./Modal";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function PwaControls({ isDemo }: { isDemo: boolean }) {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [guide, setGuide] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [standalone, setStandalone] = useState(
    window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );
  const [installing, setInstalling] = useState(false);
  useEffect(() => {
    let alive = true;
    let reload = false;
    const media = window.matchMedia("(display-mode: standalone)");
    const onMedia = () => setStandalone(media.matches);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setInstall(null);
      setGuide(false);
    };
    const checkConnection = async () => {
      if (!navigator.onLine) {
        if (alive) setOffline(true);
        return;
      }
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}manifest.webmanifest`,
          { cache: "no-store", signal: AbortSignal.timeout(4000) },
        );
        if (alive) setOffline(!response.ok);
      } catch {
        if (alive) setOffline(true);
      }
    };
    const onNetwork = () => {
      void checkConnection();
    };
    const onController = () => {
      if (reload) location.reload();
    };
    const onActivate = () => {
      reload = true;
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onNetwork);
    window.addEventListener("offline", onNetwork);
    window.addEventListener("hanpun-activate-update", onActivate);
    media.addEventListener("change", onMedia);
    let reg: ServiceWorkerRegistration | undefined;
    let worker: ServiceWorker | null = null;
    const onState = () => {
      if (
        alive &&
        worker?.state === "installed" &&
        navigator.serviceWorker.controller
      )
        setWaiting(reg?.waiting ?? worker);
    };
    const onFound = () => {
      worker = reg?.installing ?? null;
      worker?.addEventListener("statechange", onState);
    };
    const onFocus = () => {
      void checkConnection();
      if (navigator.onLine) void reg?.update().catch(() => {});
    };
    void checkConnection();
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onController,
      );
      void navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: "none",
        })
        .then((registration) => {
          if (!alive) return;
          reg = registration;
          if (reg.waiting) setWaiting(reg.waiting);
          reg.addEventListener("updatefound", onFound);
          onFound();
        })
        .catch(() => {});
      window.addEventListener("focus", onFocus);
    }
    return () => {
      alive = false;
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onNetwork);
      window.removeEventListener("offline", onNetwork);
      window.removeEventListener("hanpun-activate-update", onActivate);
      window.removeEventListener("focus", onFocus);
      media.removeEventListener("change", onMedia);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        onController,
      );
      reg?.removeEventListener("updatefound", onFound);
      worker?.removeEventListener("statechange", onState);
    };
  }, []);
  return (
    <>
      <div className="pwa-controls">
        {offline && (
          <p className="pwa-status" role="status">
            <WifiOff size={14} />
            {isDemo
              ? "오프라인 · 기록은 이 기기에 저장돼요."
              : "오프라인 · 계정 기록을 불러오고 저장하려면 인터넷 연결이 필요해요."}
          </p>
        )}
        {waiting && (
          <button
            className="text-button"
            onClick={() => {
              window.dispatchEvent(new Event("hanpun-activate-update"));
              waiting.postMessage({ type: "ACTIVATE_UPDATE" });
            }}
          >
            <RefreshCw size={14} />새 버전으로 새로고침
          </button>
        )}
        {!standalone && (
          <button
            className="text-button"
            disabled={installing}
            onClick={async () => {
              if (!install) {
                setGuide(true);
                return;
              }
              setInstalling(true);
              try {
                await install.prompt();
                await install.userChoice;
                setInstall(null);
              } catch {
                setGuide(true);
              } finally {
                setInstalling(false);
              }
            }}
          >
            <Download size={14} />홈 화면에 설치
          </button>
        )}
      </div>
      {guide && (
        <Modal
          title="한푼을 가까이에"
          description="홈 화면에서 앱처럼 바로 열어보세요."
          onClose={() => setGuide(false)}
        >
          <div className="prose-content">
            <h3>iPhone · iPad</h3>
            <p>
              Safari에서 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해주세요.
            </p>
            <h3>Android · 컴퓨터</h3>
            <p>
              Chrome이나 Edge 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를
              선택해주세요. 다른 앱 안에서 열었다면 먼저 기본 브라우저로
              열어주세요.
            </p>
            <p className="form-hint">
              처음에는 인터넷에 연결해 열어주세요. 이후 이 기기 가계부는
              오프라인에서도 사용할 수 있어요. Google 로그인, 계정 저장과 AI
              분석에는 인터넷이 필요해요.
            </p>
            <button
              className="button primary full-width"
              onClick={() => setGuide(false)}
            >
              알겠어요
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
