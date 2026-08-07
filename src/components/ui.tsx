"use client";

import { useState } from "react";
import type {
  AppointmentStatus,
  DocumentStatus,
  Intent,
} from "@/lib/types";
import {
  APPT_LABEL,
  DOC_LABEL,
  APPT_INTENT,
  DOC_INTENT,
} from "@/lib/types";

// ---- Status chip -----------------------------------------------------------
const INTENT_CLASS: Record<Intent, string> = {
  appt: "bg-appt-soft text-appt",
  docs: "bg-docs-soft text-docs",
  overdue: "bg-overdue-soft text-overdue",
  soon: "bg-soon-soft text-soon",
  done: "bg-done-soft text-done",
  muted: "bg-line text-muted",
};

export function ApptChip({ state }: { state: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${INTENT_CLASS[APPT_INTENT[state]]}`}>
      <Dot intent={APPT_INTENT[state]} />
      {APPT_LABEL[state]}
    </span>
  );
}

export function DocChip({ state, dormant }: { state: DocumentStatus; dormant?: boolean }) {
  if (dormant || state === "awaiting_appointment") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-line/60 px-2.5 py-1 text-xs font-medium text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-muted/50" />
        {DOC_LABEL.awaiting_appointment}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${INTENT_CLASS[DOC_INTENT[state]]}`}>
      <Dot intent={DOC_INTENT[state]} />
      {DOC_LABEL[state]}
    </span>
  );
}

function Dot({ intent }: { intent: Intent }) {
  const c: Record<Intent, string> = {
    appt: "bg-appt", docs: "bg-docs", overdue: "bg-overdue",
    soon: "bg-soon", done: "bg-done", muted: "bg-muted",
  };
  return <span className={`h-1.5 w-1.5 rounded-full ${c[intent]}`} />;
}

// ---- Copyable VOR code (the "tracking number") -----------------------------
export function CodeChip({ code, big }: { code: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {}
  }
  return (
    <button
      onClick={copy}
      title="Copy tracking code"
      className={`group inline-flex items-center gap-1.5 rounded-lg border border-line font-mono font-medium text-navy hover:border-star hover:bg-star/5 transition ${
        big ? "px-3 py-1.5 text-base" : "px-2 py-1 text-xs"
      } ${copied ? "copied-flash" : ""}`}
    >
      {code}
      <span className="text-muted group-hover:text-star">
        {copied ? "✓" : "⧉"}
      </span>
    </button>
  );
}

// ---- Attempt badge (e.g. 3/5) ----------------------------------------------
export function AttemptBadge({ n, cap, label }: { n: number; cap: number; label: string }) {
  const near = n >= cap - 1;
  return (
    <span
      title={`${label}: ${n} of ${cap}`}
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        near ? "bg-overdue-soft text-overdue" : "bg-line text-muted"
      }`}
    >
      {n}/{cap}
    </span>
  );
}

// ---- Card ------------------------------------------------------------------
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl2 border border-line bg-white shadow-card ${className}`}>{children}</div>;
}
