"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Icon, type IconName } from "@/components/Icon";

// ---- Status chip -----------------------------------------------------------
// Every variant is spelled out so Tailwind sees each class at build time.
export const INTENT_CLASS: Record<Intent, string> = {
  appt: "bg-appt-soft text-appt ring-1 ring-inset ring-appt/10",
  docs: "bg-docs-soft text-docs ring-1 ring-inset ring-docs/10",
  overdue: "bg-overdue-soft text-overdue ring-1 ring-inset ring-overdue/15",
  soon: "bg-soon-soft text-soon ring-1 ring-inset ring-soon/15",
  done: "bg-done-soft text-done ring-1 ring-inset ring-done/15",
  muted: "bg-slate-soft text-slate ring-1 ring-inset ring-slate/10",
};

const DOT_CLASS: Record<Intent, string> = {
  appt: "bg-appt", docs: "bg-docs", overdue: "bg-overdue shadow-glow-overdue",
  soon: "bg-soon", done: "bg-done", muted: "bg-muted",
};

const chip = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold animate-chip-in";

export function ApptChip({ state }: { state: AppointmentStatus }) {
  const intent = APPT_INTENT[state];
  return (
    // key: a status change re-mounts the chip, replaying the fade + scale
    <span key={state} className={`${chip} ${INTENT_CLASS[intent]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[intent]}`} />
      <span className="sr-only">Appointment: </span>
      {APPT_LABEL[state]}
    </span>
  );
}

export function DocChip({ state, dormant }: { state: DocumentStatus; dormant?: boolean }) {
  if (dormant || state === "awaiting_appointment") {
    return (
      <span className={`${chip} bg-canvas text-muted ring-1 ring-inset ring-line`}>
        <Icon name="lock" className="h-3 w-3" />
        <span className="sr-only">Records: </span>
        {DOC_LABEL.awaiting_appointment}
      </span>
    );
  }
  const intent = DOC_INTENT[state];
  return (
    <span key={state} className={`${chip} ${INTENT_CLASS[intent]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[intent]}`} />
      <span className="sr-only">Records: </span>
      {DOC_LABEL[state]}
    </span>
  );
}

// Generic pill for a closed-kind or similar intent label.
export function IntentChip({ intent, children, icon }: { intent: Intent; children: React.ReactNode; icon?: IconName }) {
  return (
    <span className={`${chip} ${INTENT_CLASS[intent]}`}>
      {icon ? <Icon name={icon} className="h-3 w-3" /> : <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[intent]}`} />}
      {children}
    </span>
  );
}

// ---- Follow-up tag (Overdue / Due soon / On track) --------------------------
// Solid-ish pill with an icon: says what to do about timing.
export type { FollowupKind } from "@/lib/statusEngine";
import type { FollowupKind } from "@/lib/statusEngine";
const FOLLOWUP: Record<FollowupKind, { label: string; cls: string; icon: IconName }> = {
  overdue:     { label: "Overdue",  cls: "bg-overdue text-white shadow-glow-overdue", icon: "alert" },
  soon:        { label: "Due soon", cls: "bg-soon text-white", icon: "clock" },
  ontrack:     { label: "On track", cls: "bg-docs-soft text-docs ring-1 ring-inset ring-docs/15", icon: "check" },
  unreachable: { label: "Patient unreachable", cls: "bg-overdue text-white", icon: "userX" },
};

export function FollowupTag({ kind }: { kind: FollowupKind }) {
  const f = FOLLOWUP[kind];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${f.cls}`}>
      <Icon name={f.icon} className="h-3 w-3" strokeWidth={2.2} />
      <span className="sr-only">Follow-up: </span>
      {f.label}
    </span>
  );
}

// ---- Stale tag: no real action for 7+ / 14+ days (not the same as overdue) --
// Outlined and square-cornered so it never reads as a status or as Overdue.
export function StaleChip({ tag }: { tag: string | null }) {
  if (!tag) return null;
  const strong = tag.includes("14");
  return (
    <span
      title="No status update for this long. Not the same as overdue."
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-dashed px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${
        strong ? "border-overdue/40 text-overdue" : "border-soon/40 text-soon"
      }`}
    >
      <Icon name="clock" className="h-3 w-3" />
      {tag}
    </span>
  );
}

// ---- Copyable VOR code (the "tracking number") -----------------------------
export function CodeChip({ code, big }: { code: string; big?: boolean }) {
  const [copied, setCopied] = useState(0);
  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied((n) => n + 1);
      setTimeout(() => setCopied(0), 1200);
    } catch {}
  }
  return (
    <button
      key={copied ? `c${copied}` : "idle"}
      onClick={copy}
      title="Copy tracking code"
      aria-label={`Copy tracking code ${code}`}
      className={`group inline-flex items-center gap-1.5 rounded-ctl border bg-white font-semibold text-navy transition duration-fast num
        hover:border-star/60 hover:bg-star/5 focus-visible:outline-none focus-visible:shadow-glow-star ${
        big ? "px-3 py-1.5 text-base" : "px-2 py-1 text-xs"
      } ${copied ? "animate-flash-ok border-docs/50" : "border-line"}`}
    >
      {code}
      <span className={copied ? "text-docs" : "text-muted group-hover:text-star"}>
        <Icon name={copied ? "check" : "copy"} className={big ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={copied ? 2.4 : 1.8} />
      </span>
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}

// ---- MRN (PHI) — always as text, leading zeros intact -----------------------
export function Mrn({ value, className = "" }: { value: string | null; className?: string }) {
  return <span className={`num font-semibold tracking-wide text-ink ${className}`}>{value || "—"}</span>;
}

// ---- Attempt badge ------------------------------------------------------------
export function AttemptBadge({ n, cap, label, long }: { n: number; cap: number; label: string; long?: boolean }) {
  const near = n >= cap - 1;
  return (
    <span
      title={`${label}: ${n} of ${cap}`}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold num ${
        near ? "bg-overdue-soft text-overdue" : "bg-slate-soft text-slate"
      }`}
    >
      {long ? `Attempt ${n} of ${cap}` : `${n}/${cap}`}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

// ---- Card ------------------------------------------------------------------
export type CardTone = "plain" | "appt" | "docs" | "overdue" | "soon" | "done" | "neutral";
const CARD_TONE: Record<CardTone, string> = {
  plain: "bg-white border-line",
  neutral: "bg-surface-neutral border-line",
  appt: "bg-surface-appt border-appt/15",
  docs: "bg-surface-docs border-docs/15",
  overdue: "bg-surface-overdue border-overdue/15",
  soon: "bg-surface-soon border-soon/15",
  done: "bg-surface-done border-docs/15",
};

export function Card({
  children,
  className = "",
  tone = "plain",
  interactive,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: CardTone;
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-xl2 border shadow-surface ${CARD_TONE[tone]} ${
        interactive ? "transition duration-fast ease-out hover:-translate-y-0.5 hover:shadow-lifted" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ---- Headings ---------------------------------------------------------------
export function PageHeader({
  title,
  description,
  children,
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[26px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}

export function SectionHeading({
  title,
  icon,
  children,
  eyebrow,
}: {
  title: string;
  icon?: IconName;
  children?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-ctl bg-canvas text-navy ring-1 ring-inset ring-line">
            <Icon name={icon} />
          </span>
        )}
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2 className="section-title">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

// ---- Empty / error states -----------------------------------------------------
export function EmptyState({
  icon = "check",
  title,
  children,
  action,
  compact,
}: {
  icon?: IconName;
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "py-8" : "py-14"}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-star-200/60 to-docs-soft text-navy">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-3 font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && (
        <Link href={action.href} className="btn btn-secondary mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}

// Failure is not "nothing found": different surface, different words, a retry.
export function ErrorState({
  title,
  children,
  onRetry,
}: {
  title: string;
  children?: React.ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl2 border border-overdue/20 bg-overdue-soft/60 px-5 py-6 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-overdue shadow-surface">
        <Icon name="alert" />
      </span>
      <p className="mt-3 font-semibold text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary mt-4">
          <Icon name="refresh" /> Try Again
        </button>
      )}
    </div>
  );
}

export function InlineError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-ctl bg-overdue-soft px-3 py-2 text-sm text-overdue">
      <Icon name="alert" className="mt-0.5 h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
