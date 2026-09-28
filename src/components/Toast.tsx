"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";

// Tiny app-wide toast bus: toast() from any client component, <Toaster/> once
// in the layout. Success fades on its own; errors stay until dismissed so a
// failed save never looks like it worked. Toasts are feedback only — every
// change is also visible in the page itself (journey, timeline, lists).
export type ToastKind = "success" | "warning" | "error";
type Item = { id: number; kind: ToastKind; text: string };

let nextId = 1;
const listeners = new Set<(t: Item) => void>();

export function toast(text: string, kind: ToastKind = "success") {
  const item = { id: nextId++, kind, text };
  listeners.forEach((l) => l(item));
}

const STYLE: Record<ToastKind, { box: string; icon: IconName; iconClass: string }> = {
  success: { box: "border-docs/20 bg-gradient-to-br from-white/95 to-docs-soft/90", icon: "check", iconClass: "bg-docs text-white" },
  warning: { box: "border-soon/25 bg-gradient-to-br from-white/95 to-soon-soft/90", icon: "alert", iconClass: "bg-soon text-white" },
  error:   { box: "border-overdue/25 bg-gradient-to-br from-white/95 to-overdue-soft/90", icon: "alert", iconClass: "bg-overdue text-white" },
};

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const add = (t: Item) => {
      setItems((s) => [...s.slice(-2), t]);
      if (t.kind !== "error") {
        setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), t.kind === "warning" ? 6000 : 3200);
      }
    };
    listeners.add(add);
    return () => { listeners.delete(add); };
  }, []);

  return (
    // bottom-left: clear of the page's primary buttons, which sit right/center
    <div className="pointer-events-none fixed bottom-5 left-4 right-4 z-[60] flex flex-col items-start gap-2 sm:left-6 sm:right-auto">
      {items.map((t) => {
        const s = STYLE[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-sm animate-toast-in items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium text-ink shadow-lifted backdrop-blur-md ${s.box}`}
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${s.iconClass}`}>
              <Icon name={s.icon} className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
            <span className="flex-1">{t.text}</span>
            <button
              onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))}
              className="rounded-md p-1 text-muted hover:bg-navy/5 hover:text-ink"
              aria-label="Dismiss"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
