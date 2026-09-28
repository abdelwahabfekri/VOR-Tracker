"use client";

import { useState } from "react";
import type { StatusHistoryEntry } from "@/lib/types";
import { APPT_LABEL, DOC_LABEL } from "@/lib/types";
import { noteLabel, noteIcon, isAdminEvent } from "@/lib/noteCodes";
import { fmtDateTime, fmtTime, NY_TZ } from "@/lib/tz";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/ui";

// ============================================================================
// Activity Timeline — the full dated history (the journey shows only where
// the referral is now). Newest first, grouped by Eastern-Time day.
//   Blue  = appointment track · Green = records track
//   Navy/slate = admin & system events (corrections, edits, follow-up moves)
// ============================================================================

function stateLabel(track: string, s: string | null): string {
  if (!s) return "—";
  return (track === "document" ? DOC_LABEL : APPT_LABEL)[s as never] ?? s;
}

type Tone = "appt" | "docs" | "admin";

function toneOf(e: StatusHistoryEntry): Tone {
  if (isAdminEvent(e.note_code) || e.track === "meta") return "admin";
  return e.track === "document" ? "docs" : "appt";
}

const TONE: Record<Tone, { icon: string; card: string; track: string; label: string }> = {
  appt:  { icon: "bg-appt text-white", card: "border-appt/15 bg-white", track: "bg-appt-soft text-appt", label: "Appointment" },
  docs:  { icon: "bg-docs text-white", card: "border-docs/15 bg-white", track: "bg-docs-soft text-docs", label: "Records" },
  admin: { icon: "bg-navy-700 text-white", card: "border-navy/15 bg-slate-soft/60", track: "bg-navy/10 text-navy", label: "Admin" },
};

// From → To and other context worth showing inline.
function detail(e: StatusHistoryEntry): string | null {
  const code = (e.note_code ?? "").replace(/^inbound_/, "");
  switch (code) {
    case "status_corrected":
      return `${stateLabel(e.track, e.from_state)} → ${stateLabel(e.track, e.to_state)}`;
    case "followup_set":
      return `${e.from_state ? `${fmtDateTime(e.from_state)} → ` : ""}${fmtDateTime(e.to_state)}`;
    case "existing_baseline": {
      const [a, d] = e.to_state.split("/");
      return `Entered at: ${stateLabel("appointment", a)} · ${stateLabel("document", d)}`;
    }
    case "details_edited":
      return null; // the note lists field names only, never values
    default:
      if (e.track !== "meta" && e.from_state && e.from_state !== e.to_state) {
        return `${stateLabel(e.track, e.from_state)} → ${stateLabel(e.track, e.to_state)}`;
      }
      return null;
  }
}

const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: NY_TZ }); // YYYY-MM-DD in ET
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: NY_TZ, weekday: "short", month: "short", day: "numeric", year: "numeric" });

const INITIAL = 8;

export function ScanHistory({ entries }: { entries: StatusHistoryEntry[] }) {
  const [all, setAll] = useState(false);
  if (entries.length === 0) {
    return <EmptyState icon="history" title="No Activity Yet" compact>Every call, status change and correction will be listed here.</EmptyState>;
  }

  const sorted = [...entries].sort((a, b) => b.changed_at.localeCompare(a.changed_at)); // newest first
  const shown = all ? sorted : sorted.slice(0, INITIAL);
  const groups: { key: string; label: string; items: StatusHistoryEntry[] }[] = [];
  for (const e of shown) {
    const k = dayKey(e.changed_at);
    const g = groups[groups.length - 1];
    if (g && g.key === k) g.items.push(e);
    else groups.push({ key: k, label: dayLabel(e.changed_at), items: [e] });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 text-2xs text-muted" aria-hidden>
        <Legend cls="bg-appt" label="Appointment" />
        <Legend cls="bg-docs" label="Records" />
        <Legend cls="bg-navy-700" label="Admin / correction" />
      </div>
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <h3 className="eyebrow mb-2.5">{g.label}</h3>
            <ol className="relative space-y-2.5 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line">
              {g.items.map((e) => {
                const tone = toneOf(e);
                const t = TONE[tone];
                const inbound = (e.note_code ?? "").startsWith("inbound_");
                const d = detail(e);
                const correction = (e.note_code ?? "") === "status_corrected";
                const latest = e.id === sorted[0].id;
                return (
                  <li key={e.id} className="relative flex gap-3">
                    <span className={`relative z-[1] mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${t.icon} ${latest ? (tone === "docs" ? "shadow-glow-docs" : "shadow-glow-appt") : ""}`}>
                      <Icon name={noteIcon(e.note_code)} className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <div className={`min-w-0 flex-1 rounded-ctl border px-3 py-2.5 ${t.card} ${correction ? "border-l-4 border-l-navy" : ""}`}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-ink">{noteLabel(e.note_code)}</span>
                        <span className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${t.track}`}>
                          {tone === "admin" && e.track !== "meta" ? `Admin · ${e.track === "document" ? "Records" : "Appointment"}` : t.label}
                        </span>
                        {inbound && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-docs">
                            <Icon name="phoneIn" className="h-3 w-3" /> Incoming
                          </span>
                        )}
                      </div>
                      {d && <div className="mt-1 text-xs text-ink/80">{d}</div>}
                      {e.note_text && (
                        <p className="mt-1.5 rounded-md bg-white/80 px-2 py-1 text-xs text-ink ring-1 ring-inset ring-line">
                          {e.note_code === "status_corrected" ? "Reason: " : ""}{e.note_text}
                        </p>
                      )}
                      <div className="num mt-1 text-[10.5px] text-muted">{fmtTime(e.changed_at)}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {sorted.length > INITIAL && (
        <button onClick={() => setAll((v) => !v)} className="btn btn-ghost btn-sm mt-4">
          <Icon name={all ? "chevronDown" : "history"} className={`h-3.5 w-3.5 ${all ? "rotate-180" : ""}`} />
          {all ? "Show recent only" : `Show full history (${sorted.length} events)`}
        </button>
      )}
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${cls}`} />
      {label}
    </span>
  );
}
