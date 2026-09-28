"use client";

import { useEffect, useRef, useState } from "react";
import type { Referral, StatusHistoryEntry } from "@/lib/types";
import { buildJourney, TOTAL_MILESTONES, type Milestone, type MilestoneKey, type JourneyModel } from "@/lib/journey";
import { CAPS, followupKind, nextActionLabel } from "@/lib/statusEngine";
import { Card, FollowupTag } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { fmtShortDate, fmtTime, fmtDateTime } from "@/lib/tz";

// ============================================================================
// Referral Journey — the "where is it now" view. Progress is counted in
// milestones, never a percentage (a declined referral is not "40% done").
// ============================================================================

const ICON: Record<MilestoneKey, IconName> = {
  created: "flag",
  contacting: "phoneOut",
  scheduled: "calendar",
  confirmed: "calendarCheck",
  visit: "check",
  request_due: "fileSearch",
  requested: "mail",
  received: "fileIn",
  uploaded: "upload",
  filed: "archive",
};

// Explicit class maps per track (no runtime-built class names).
const TONE = {
  appt: {
    doneNode: "bg-track-appt text-white border-transparent",
    currentNode: "border-appt bg-white text-appt shadow-glow-appt",
    bar: "bg-appt",
    text: "text-appt",
    pulse: "rgba(47,164,231,0.45)",
    currentLabel: "text-appt",
    pill: "bg-appt-soft text-appt",
    burst: "border-star",
  },
  docs: {
    doneNode: "bg-track-docs text-white border-transparent",
    currentNode: "border-docs bg-white text-docs shadow-glow-docs",
    bar: "bg-docs",
    text: "text-docs",
    pulse: "rgba(46,125,91,0.40)",
    currentLabel: "text-docs",
    pill: "bg-docs-soft text-docs",
    burst: "border-docs",
  },
} as const;

const STATE_SR: Record<Milestone["state"], string> = {
  done: "completed",
  current: "current step",
  upcoming: "upcoming",
  locked: "locked until the visit is completed",
  stopped: "journey stopped here",
  skipped: "not reached",
};

export function ReferralJourney({ referral, history }: { referral: Referral; history: StatusHistoryEntry[] }) {
  const model = buildJourney(referral, history);
  const justDone = useCompletionFeedback(model);
  const f = followupKind(referral);
  const a = referral.appointment_state;

  const badges: { label: string; tone: string; icon: IconName }[] = [];
  if (model.recordsUnlocked) badges.push({ label: "Appointment track complete", tone: "bg-appt-soft text-appt", icon: "check" });
  if (model.phase === "active" && model.recordsUnlocked) badges.push({ label: "Records track active", tone: "bg-docs-soft text-docs", icon: "file" });
  if (model.phase === "active" && ["referral_created", "patient_contacted", "awaiting_booking"].includes(a) && referral.contact_attempts > 0)
    badges.push({ label: `Attempt ${referral.contact_attempts} of ${CAPS.contact}`, tone: "bg-slate-soft text-slate", icon: "phone" });
  if (model.phase === "active" && (a === "patient_contacted" || a === "awaiting_booking"))
    badges.push({ label: "3-day follow-up", tone: "bg-slate-soft text-slate", icon: "clock" });
  if (model.phase === "active" && referral.document_state === "documents_requested")
    badges.push({ label: `5-day follow-up · chase ${referral.document_attempts} of ${CAPS.document}`, tone: "bg-slate-soft text-slate", icon: "clock" });

  return (
    <Card className="overflow-hidden" tone={model.recordsUnlocked ? "docs" : "appt"}>
      {/* Journey header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line/70 px-5 pb-4 pt-5 md:px-6">
        <div className="min-w-0">
          <div className="eyebrow">
            {model.currentTrack === "records" ? "Records track" : model.currentTrack === "appointment" ? "Appointment track" : "Journey"}
          </div>
          <h2 className="mt-0.5 text-lg font-semibold text-ink">Referral Journey</h2>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            <span className="num font-semibold text-ink">{model.completed}</span> of{" "}
            <span className="num font-semibold text-ink">{TOTAL_MILESTONES}</span> milestones complete
            {model.phase === "complete" && " — referral filed and closed"}
          </p>
          <ProgressSegments model={model} />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <PhaseChip model={model} />
          {model.phase === "active" && (
            <div className="text-left text-sm sm:text-right">
              <div className="font-medium text-ink">{nextActionLabel(referral)}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted sm:justify-end">
                {referral.next_action_due ? <>Due {fmtDateTime(referral.next_action_due)}</> : "No due date — review"}
                {f && <FollowupTag kind={f} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-4 md:px-6">
          {badges.map((b) => (
            <span key={b.label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold ${b.tone}`}>
              <Icon name={b.icon} className="h-3 w-3" strokeWidth={2.2} />
              {b.label}
            </span>
          ))}
        </div>
      )}

      {/* Route: horizontal on wide screens, vertical stepper below */}
      <div className="px-5 pb-6 pt-5 md:px-6">
        <HorizontalRoute model={model} justDone={justDone} />
        <VerticalRoute model={model} justDone={justDone} />
        {model.endedLabel && (
          <div className="mt-5 flex items-start gap-2.5 rounded-ctl border border-line bg-canvas px-3.5 py-2.5 text-sm">
            <Icon name={model.phase === "incomplete" ? "alert" : "ban"} className={`mt-0.5 h-4 w-4 ${model.phase === "incomplete" ? "text-overdue" : "text-muted"}`} />
            <div>
              <div className="font-semibold text-ink">Journey ended: {model.endedLabel}</div>
              <div className="text-xs text-muted">
                {model.phase === "incomplete"
                  ? "Records could not be obtained. This is an incomplete closure, not a success."
                  : "Later milestones were not reached. Nothing after this point failed — the referral stopped here."}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// When the journey advances after an action (router.refresh re-renders with
// new props), light up the newly completed milestones and say so once.
// ---------------------------------------------------------------------------
function useCompletionFeedback(model: JourneyModel): Set<number> {
  const prev = useRef<number | null>(null);
  const [justDone, setJustDone] = useState<Set<number>>(new Set());

  useEffect(() => {
    const before = prev.current;
    prev.current = model.completed;
    if (before === null || model.completed <= before) return;
    const fresh = new Set<number>();
    for (let i = before; i < model.completed; i++) fresh.add(i);
    setJustDone(fresh);
    // Name what was achieved: finishing a stage means reaching the next one
    // (leaving "Records request needed" = "Records requested").
    const reached = model.milestones[model.completed];
    toast(
      model.completed === 5 && before < 5
        ? "Milestone completed: Visit completed — records workflow unlocked"
        : `Milestone completed: ${reached ? reached.label : "Filed & closed"}`
    );
    const t = setTimeout(() => setJustDone(new Set()), 1400);
    return () => clearTimeout(t);
  }, [model.completed, model.milestones]);

  return justDone;
}

function ProgressSegments({ model }: { model: JourneyModel }) {
  return (
    <div className="mt-3 flex w-64 max-w-full gap-1" aria-hidden>
      {model.milestones.map((m) => (
        <span
          key={m.key}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-milestone ${
            m.state === "done"
              ? m.track === "appt" ? "bg-appt" : "bg-docs"
              : m.state === "current"
              ? m.track === "appt" ? "bg-star-light" : "bg-docs/40"
              : m.state === "stopped"
              ? "bg-muted/50"
              : "bg-line"
          }`}
        />
      ))}
    </div>
  );
}

function PhaseChip({ model }: { model: JourneyModel }) {
  const map = {
    active:     { text: model.currentTrack === "records" ? "In progress · Records" : "In progress · Appointment", cls: model.currentTrack === "records" ? "bg-docs-soft text-docs" : "bg-appt-soft text-appt", icon: "route" as IconName },
    complete:   { text: "Completed", cls: "bg-done-soft text-done", icon: "check" as IconName },
    ended:      { text: "Journey ended", cls: "bg-slate-soft text-slate", icon: "ban" as IconName },
    incomplete: { text: "Incomplete closure", cls: "bg-overdue-soft text-overdue", icon: "alert" as IconName },
  }[model.phase];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${map.cls}`}>
      <Icon name={map.icon} className="h-3.5 w-3.5" />
      {map.text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------
function Node({ m, fresh, size = "lg" }: { m: Milestone; fresh: boolean; size?: "lg" | "sm" }) {
  const t = TONE[m.track];
  const dims = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const ico = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  let cls: string;
  let icon: IconName = ICON[m.key];
  switch (m.state) {
    case "done":
      cls = t.doneNode;
      icon = "check";
      break;
    case "current":
      cls = `${t.currentNode} ring-4 ring-white animate-pulse-once`;
      break;
    case "stopped":
      cls = "border-muted/40 bg-slate-soft text-slate";
      icon = "ban";
      break;
    case "locked":
      cls = "border-dashed border-line bg-canvas text-muted/60";
      icon = "lock";
      break;
    case "skipped":
      cls = "border-line bg-canvas text-muted/50";
      break;
    default:
      cls = "border-line bg-white text-muted";
  }
  return (
    <span className="relative flex items-center justify-center">
      {fresh && <span className={`absolute inset-0 rounded-2xl border-2 ${t.burst} animate-burst`} aria-hidden />}
      <span
        // re-key on state so the one-time pulse replays after an update, not continuously
        key={m.state}
        style={m.state === "current" ? ({ ["--pulse" as string]: t.pulse } as React.CSSProperties) : undefined}
        className={`relative z-[1] flex ${dims} items-center justify-center rounded-2xl border-2 transition duration-milestone ${cls}`}
      >
        <Icon name={icon} className={`${ico} ${fresh ? "animate-check-pop" : ""}`} strokeWidth={m.state === "done" ? 2.6 : 1.9} />
      </span>
    </span>
  );
}

function NodeCaption({ m, align = "center" }: { m: Milestone; align?: "center" | "left" }) {
  const t = TONE[m.track];
  const labelCls =
    m.state === "current" ? `font-semibold ${t.currentLabel}` :
    m.state === "done" ? "font-medium text-ink" :
    m.state === "stopped" ? "font-semibold text-slate" :
    "text-muted";
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <div className={`text-xs leading-snug ${labelCls}`}>
        {m.label}
        <span className="sr-only"> — {STATE_SR[m.state]}</span>
      </div>
      {m.state === "current" && (
        <span className={`mt-1 inline-block rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wider ${t.pill}`}>Current</span>
      )}
      {m.state === "stopped" && (
        <span className="mt-1 inline-block rounded-full bg-slate-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-slate">Stopped</span>
      )}
      {m.date && m.state === "done" && (
        <div className="num mt-0.5 text-[10.5px] leading-tight text-muted">
          <span className="whitespace-nowrap">{fmtShortDate(m.date)}</span>{" "}
          <span className="whitespace-nowrap">{fmtTime(m.date)}</span>
        </div>
      )}
      {m.state === "locked" && m.key === "request_due" && (
        <div className="mt-0.5 text-[10.5px] leading-tight text-muted">Unlocks after visit</div>
      )}
    </div>
  );
}

function Connector({ from, to, fresh, vertical }: { from: Milestone; to: Milestone; fresh: boolean; vertical?: boolean }) {
  const filled = from.state === "done" && (to.state === "done" || to.state === "current" || to.state === "stopped");
  const t = TONE[to.track === from.track ? from.track : "docs"];
  const base = vertical ? "w-0.5 h-full" : "h-0.5 w-full";
  return (
    <span className={`relative block overflow-hidden rounded-full ${base} bg-line`} aria-hidden>
      {filled && (
        <span
          className={`absolute inset-0 ${t.bar} ${vertical ? "origin-top" : "origin-left"} ${fresh ? (vertical ? "animate-fill-y" : "animate-fill-x") : ""}`}
        />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Desktop: two connected tracks with the handoff between them.
// ---------------------------------------------------------------------------
function HorizontalRoute({ model, justDone }: { model: JourneyModel; justDone: Set<number> }) {
  const appt = model.milestones.slice(0, 5);
  const docs = model.milestones.slice(5);
  return (
    <ol className="hidden items-stretch gap-2 lg:flex" aria-label="Referral journey milestones">
      <TrackPanel title="Appointment" milestones={appt} justDone={justDone} tone="appt" dim={model.phase === "ended"} />
      <li className="flex w-[128px] shrink-0 flex-col items-center justify-center" aria-hidden={!model.recordsUnlocked}>
        <Handoff unlocked={model.recordsUnlocked} fresh={justDone.has(4)} />
      </li>
      <TrackPanel title="Records" milestones={docs} justDone={justDone} tone="docs" dim={!model.recordsUnlocked} />
    </ol>
  );
}

function TrackPanel({
  title, milestones, justDone, tone, dim,
}: { title: string; milestones: Milestone[]; justDone: Set<number>; tone: "appt" | "docs"; dim: boolean }) {
  return (
    <li className={`flex-1 rounded-2xl border px-2 pb-3 pt-2.5 transition-opacity duration-milestone ${
      tone === "appt" ? "border-appt/10 bg-appt-soft/40" : "border-docs/10 bg-docs-soft/40"
    } ${dim ? "opacity-70" : ""}`}>
      <div className={`mb-3 px-2 text-2xs font-semibold uppercase tracking-[0.08em] ${tone === "appt" ? "text-appt" : "text-docs"}`}>
        {title} track
      </div>
      <ol className="flex">
        {milestones.map((m, i) => (
          <li key={m.key} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span className="flex-1">{i > 0 && <Connector from={milestones[i - 1]} to={m} fresh={justDone.has(m.index - 1)} />}</span>
              <Node m={m} fresh={justDone.has(m.index)} />
              <span className="flex-1">{i < milestones.length - 1 && <Connector from={m} to={milestones[i + 1]} fresh={justDone.has(m.index)} />}</span>
            </div>
            <div className="mt-2 px-0.5"><NodeCaption m={m} /></div>
          </li>
        ))}
      </ol>
    </li>
  );
}

function Handoff({ unlocked, fresh }: { unlocked: boolean; fresh: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition duration-milestone ${
        unlocked ? "border-docs/20 bg-handoff shadow-surface" : "border-dashed border-line bg-white/60"
      } ${fresh ? "shadow-glow-docs" : ""}`}
    >
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${unlocked ? "bg-white text-docs" : "bg-canvas text-muted"}`}>
        <Icon name={unlocked ? "unlock" : "lock"} className="h-3.5 w-3.5" />
      </span>
      <span className={`text-[10.5px] font-semibold leading-tight ${unlocked ? "text-docs" : "text-muted"}`}>
        {unlocked ? "Appointment complete — records workflow unlocked" : "Records unlock after the visit"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile / tablet: vertical stepper; upcoming steps fold away.
// ---------------------------------------------------------------------------
function VerticalRoute({ model, justDone }: { model: JourneyModel; justDone: Set<number> }) {
  const [showAll, setShowAll] = useState(false);
  const pivot = model.milestones.findIndex((m) => m.state === "current" || m.state === "stopped");
  const lastVisible = showAll || pivot < 0 ? model.milestones.length - 1 : Math.min(pivot + 1, model.milestones.length - 1);
  const hidden = model.milestones.length - 1 - lastVisible;
  const items = model.milestones.slice(0, lastVisible + 1);

  return (
    <div className="lg:hidden">
      <ol aria-label="Referral journey milestones">
        {items.map((m, i) => {
          const next = model.milestones[m.index + 1];
          const showHandoff = m.key === "visit";
          return (
            <li key={m.key}>
              {i === 0 && <TrackLabel tone="appt">Appointment track</TrackLabel>}
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <Node m={m} fresh={justDone.has(m.index)} size="sm" />
                  {next && i < items.length - 1 && (
                    <span className="my-1 min-h-[18px] flex-1">
                      <Connector from={m} to={next} fresh={justDone.has(m.index)} vertical />
                    </span>
                  )}
                </div>
                <div className="pb-4 pt-1.5"><NodeCaption m={m} align="left" /></div>
              </div>
              {showHandoff && i < items.length - 1 && (
                <div className="mb-3 ml-12">
                  <div className={`rounded-ctl px-3 py-2 text-xs font-semibold ${model.recordsUnlocked ? "bg-handoff text-docs" : "border border-dashed border-line text-muted"}`}>
                    {model.recordsUnlocked ? "Appointment complete — records workflow unlocked" : "Records unlock after the visit"}
                  </div>
                  <TrackLabel tone="docs">Records track</TrackLabel>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {hidden > 0 && !showAll && (
        <button onClick={() => setShowAll(true)} className="btn btn-ghost btn-sm ml-9 mt-1">
          <Icon name="chevronDown" className="h-3.5 w-3.5" />
          Show {hidden} upcoming milestone{hidden === 1 ? "" : "s"}
        </button>
      )}
      {showAll && pivot >= 0 && (
        <button onClick={() => setShowAll(false)} className="btn btn-ghost btn-sm ml-9 mt-1">Hide upcoming</button>
      )}
    </div>
  );
}

function TrackLabel({ tone, children }: { tone: "appt" | "docs"; children: React.ReactNode }) {
  return (
    <div className={`mb-2 mt-1 text-2xs font-semibold uppercase tracking-[0.08em] ${tone === "appt" ? "text-appt" : "text-docs"}`}>
      {children}
    </div>
  );
}
