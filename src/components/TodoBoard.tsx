"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Referral, ReferringProvider } from "@/lib/types";
import { urgency, nextActionLabel, staleTag, CAPS, type Action } from "@/lib/statusEngine";
import { missionIcon } from "@/lib/journey";
import { performAction } from "@/lib/actions";
import { QuickActions } from "@/components/QuickActions";
import { CodeChip, AttemptBadge, Card, StaleChip, Mrn, EmptyState } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ProviderFilter } from "@/components/ProviderFilter";
import { fmtShortDate } from "@/lib/tz";

// Cap / review signals still need saying; routine success does not — the
// card simply leaves the list.
const FLAG_TEXT: Record<string, string> = {
  reschedule_cap_review: "Reschedule limit reached — flagged for review.",
  parked_not_replying: "Moved to ‘Unable to reach patient’ — review needed.",
  documents_unavailable: "Marked records unavailable.",
};

type Tone = "overdue" | "soon" | "muted";

export function TodoBoard({
  referrals,
  providers,
  activeProvider,
}: {
  referrals: Referral[];
  providers: ReferringProvider[];
  activeProvider?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // cards fading out after a confirmed action; keyed by version so a card
  // that comes back after the refresh (e.g. moved to Upcoming) shows again
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  // only referrals with a due action, sorted by urgency then due date
  const actionable = useMemo(() => {
    return referrals
      .filter((r) => r.next_action_due)
      .map((r) => ({ r, u: urgency(r) }))
      .filter((x) => x.u === "overdue" || x.u === "soon" || x.u === "scheduled")
      .sort((a, b) => {
        const rank = { overdue: 0, soon: 1, scheduled: 2, none: 3 } as const;
        if (rank[a.u] !== rank[b.u]) return rank[a.u] - rank[b.u];
        return (a.r.next_action_due || "").localeCompare(b.r.next_action_due || "");
      });
  }, [referrals]);

  const overdue = actionable.filter((x) => x.u === "overdue");
  const soon = actionable.filter((x) => x.u === "soon");
  const upcoming = actionable.filter((x) => x.u === "scheduled");

  async function run(r: Referral, action: Action, note?: string): Promise<boolean> {
    setPending(true);
    const res = await performAction(r.id, r.updated_at, action, "outbound", note);
    setPending(false);
    if (!res.ok) {
      // stays up until dismissed — a failed action must not look like it worked
      toast(res.error ?? "Could not save. Try again.", "error");
      return false;
    }
    if (res.flag && FLAG_TEXT[res.flag]) toast(FLAG_TEXT[res.flag], "warning");
    setLeaving((s) => new Set(s).add(`${r.id}:${r.updated_at}`));
    setTimeout(() => router.refresh(), 260);
    return true;
  }

  return (
    <div>
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-3 pl-4">
        <ProviderFilter providers={providers} active={activeProvider} basePath="/todo" />
        <div className="flex items-center gap-2">
          <Stat n={overdue.length} label="Overdue" cls="bg-overdue-soft text-overdue" />
          <Stat n={soon.length} label="Due soon" cls="bg-soon-soft text-soon" />
          <Stat n={upcoming.length} label="Upcoming" cls="bg-slate-soft text-slate" />
        </div>
      </Card>

      {actionable.length === 0 && (
        <Card>
          <EmptyState icon="check" title="All Caught Up">
            Nothing is due right now. New calls and record chases will appear here as they come due.
          </EmptyState>
        </Card>
      )}

      <Section title="Overdue" icon="alert" items={overdue} run={run} pending={pending} tone="overdue" leaving={leaving} />
      <Section title="Due Soon" icon="clock" items={soon} run={run} pending={pending} tone="soon" leaving={leaving} />
      <Section title="Upcoming" icon="calendar" items={upcoming} run={run} pending={pending} tone="muted" leaving={leaving} />
    </div>
  );
}

function Stat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${cls}`}>
      <span className="num text-base font-bold">{n}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

const HEAD: Record<Tone, string> = {
  overdue: "from-overdue-soft to-transparent text-overdue border-overdue/15",
  soon: "from-soon-soft to-transparent text-soon border-soon/15",
  muted: "from-slate-soft to-transparent text-slate border-line",
};

function Section({
  title, icon, items, run, pending, tone, leaving,
}: {
  title: string;
  icon: IconName;
  items: { r: Referral }[];
  run: (r: Referral, a: Action, note?: string) => Promise<boolean>;
  pending: boolean;
  tone: Tone;
  leaving: Set<string>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8" aria-labelledby={`todo-${tone}`}>
      <h2
        id={`todo-${tone}`}
        className={`mb-3 flex items-center gap-2 rounded-ctl border bg-gradient-to-r px-3.5 py-2 text-sm font-semibold ${HEAD[tone]}`}
      >
        <Icon name={icon} className="h-4 w-4" />
        {title}
        <span className="num ml-1 rounded-full bg-white/80 px-2 text-xs">{items.length}</span>
      </h2>
      <ul className="space-y-3">
        {items.map(({ r }) => {
          const out = leaving.has(`${r.id}:${r.updated_at}`);
          const records = r.appointment_state === "appointment_completed";
          return (
            <li key={r.id} className={`transition ${out ? "collapse-out" : "animate-fade-up"}`} aria-hidden={out || undefined}>
              <Card className="p-4" tone={tone === "overdue" ? "overdue" : tone === "soon" ? "soon" : "plain"}>
                <div className="flex flex-wrap items-start gap-4">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white ${records ? "bg-track-docs" : "bg-track-appt"}`}>
                    <Icon name={missionIcon(r)} className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{nextActionLabel(r)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-muted">MRN</span> <Mrn value={r.mrn} className="text-xs" />
                      </span>
                      <CodeChip code={r.code} />
                      <span>{r.referring_provider_name}</span>
                      {r.specialist_name && <span>· {r.specialist_name}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 font-medium ${tone === "overdue" ? "text-overdue" : tone === "soon" ? "text-soon" : "text-muted"}`}>
                        <Icon name="clock" className="h-3.5 w-3.5" />
                        Due {fmtDue(r.next_action_due)}
                      </span>
                      {(r.appointment_state === "referral_created" || r.appointment_state === "patient_contacted" || r.appointment_state === "awaiting_booking") && (
                        <AttemptBadge n={r.contact_attempts} cap={CAPS.contact} label="Contact attempts" long />
                      )}
                      {r.document_state === "documents_requested" && (
                        <AttemptBadge n={r.document_attempts} cap={CAPS.document} label="Chase attempts" long />
                      )}
                      <StaleChip tag={staleTag(r)} />
                    </div>
                  </div>
                  <Link href={`/tracking/${r.code}`} className="btn btn-ghost btn-sm shrink-0">
                    Open <Icon name="chevronRight" className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="mt-3 border-t border-line/70 pt-3">
                  <QuickActions referral={r} onAction={(a, note) => run(r, a, note)} disabled={pending || out} compact />
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function fmtDue(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60));
  if (diff < 0) return Math.abs(diff) >= 48 ? `${Math.round(Math.abs(diff) / 24)}d ago` : `${Math.abs(diff)}h ago`;
  if (diff < 24) return `in ${diff}h`;
  return fmtShortDate(iso);
}
