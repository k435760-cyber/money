import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { X } from "lucide-react";

let openModals = 0;
let previousOverflow = "";

export function Modal({
  title,
  description,
  children,
  onClose,
  busy = false,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    if (openModals === 0) previousOverflow = document.body.style.overflow;
    openModals++;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      openModals--;
      if (openModals === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="창 닫기"
            onClick={onClose}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
