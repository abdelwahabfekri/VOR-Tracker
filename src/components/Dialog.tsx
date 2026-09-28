"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";

// Native <dialog> as a modal or a side drawer. showModal() gives the focus
// trap, Escape and inert background for free; focus goes back to whatever
// opened it on close.
export function Dialog({
  open,
  onClose,
  title,
  description,
  variant = "modal",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  variant?: "modal" | "drawer";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  // Escape / form method=dialog fire "close"; route it through onClose.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handle = () => {
      onClose();
      opener.current?.focus?.();
    };
    d.addEventListener("close", handle);
    return () => d.removeEventListener("close", handle);
  }, [onClose]);

  const titleId = `dlg-${title.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <dialog
      ref={ref}
      className={variant}
      aria-labelledby={titleId}
      // click on the backdrop closes
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
    >
      {open && (
        <div className={variant === "drawer" ? "flex h-full flex-col" : ""}>
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>
              {description && <div className="mt-1 text-sm text-muted">{description}</div>}
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="btn btn-ghost -mr-2 -mt-1 h-9 w-9 p-0"
              aria-label="Close"
            >
              <Icon name="x" />
            </button>
          </div>
          <div className={variant === "drawer" ? "flex-1 overflow-y-auto px-6 py-5" : "px-6 py-5"}>{children}</div>
        </div>
      )}
    </dialog>
  );
}
