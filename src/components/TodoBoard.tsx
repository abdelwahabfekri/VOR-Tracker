"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Referral, ReferringProvider } from "@/lib/types";
import { urgency, nextActionLabel, staleTag, CAPS, type Action } from "@/lib/statusEngine";
import { performAction } from "@/lib/actions";
import { QuickActions } from "@/components/QuickActions";
import { CodeChip, AttemptBadge, Card, StaleChip } from "@/components/ui";
import { ProviderFilter } from "@/components/ProviderFilter";
import { fmtShortDate } from "@/lib/tz";

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
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

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
      setToast({ ok: false, text: res.error ?? "Could not save. Try again." });
      return false;
    }
    const text =
      res.flag === "reschedule_cap_review" ? "Reschedule limit reached — flagged for review."
      : res.flag === "parked_not_replying" ? "Moved to ‘Unable to reach patient’."
      : res.flag === "documents_unavailable" ? "Marked records unavailable."
      : "Logged.";
    setToast({ ok: true, text });
    router.refresh();
    setTimeout(() => setToast(null), 2500);
    return true;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ProviderFilter providers={providers} active={activeProvider} basePath="/todo" />
        <div className="flex items-center gap-4 text-sm">
          <Stat n={overdue.length} label="Overdue" tone="text-overdue" />
          <Stat n={soon.length} label="Due soon" tone="text-soon" />
          <Stat n={upcoming.length} label="Upcoming" tone="text-muted" />
        </div>
      </div>

      {actionable.length === 0 && (
        <Card className="p-10 text-center">
          <div className="text-3xl">✓</div>
          <p className="mt-2 font-medium text-ink">Nothing due right now.</p>
          <p className="text-sm text-muted">New actions will appear here as referrals move through their stages.</p>
        </Card>
      )}

      <Section title="Overdue" items={overdue} run={run} pending={pending} tone="overdue" />
      <Section title="Due soon" items={soon} run={run} pending={pending} tone="soon" />
      <Section title="Upcoming" items={upcoming} run={run} pending={pending} tone="muted" />

      {toast && (
        <div
          role={toast.ok ? "status" : "alert"}
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-white shadow-pop ${toast.ok ? "bg-navy" : "bg-overdue"}`}
        >
          {toast.text}
          {!toast.ok && (
            <button onClick={() => setToast(null)} className="text-white/80 hover:text-white" aria-label="Dismiss">✕</button>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-lg font-bold ${tone}`}>{n}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}

function Section({
  title, items, run, pending, tone,
}: {
  title: string;
  items: { r: Referral }[];
  run: (r: Referral, a: Action, note?: string) => Promise<boolean>;
  pending: boolean;
  tone: "overdue" | "soon" | "muted";
}) {
  if (items.length === 0) return null;
  const bar = tone === "overdue" ? "text-overdue" : tone === "soon" ? "text-soon" : "text-muted";
  return (
    <div className="mb-7">
      <h2 className={`mb-2 text-sm font-semibold uppercase tracking-wide ${bar}`}>
        {title} · {items.length}
      </h2>
      <div className="space-y-2.5">
        {items.map(({ r }) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CodeChip code={r.code} />
                  <span className="text-sm text-muted">{r.referring_provider_name}</span>
                  <StaleChip tag={staleTag(r)} />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="font-medium text-ink">{nextActionLabel(r)}</span>
                  {r.specialist_name && (
                    <span className="text-sm text-muted">· {r.specialist_name}</span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span>Due {fmtDue(r.next_action_due)}</span>
                  {(r.appointment_state === "referral_created" || r.appointment_state === "patient_contacted" || r.appointment_state === "awaiting_booking") && (
                    <AttemptBadge n={r.contact_attempts} cap={CAPS.contact} label="Contact attempts" />
                  )}
                  {r.document_state === "documents_requested" && (
                    <AttemptBadge n={r.document_attempts} cap={CAPS.document} label="Chase attempts" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <QuickActions referral={r} onAction={(a, note) => run(r, a, note)} disabled={pending} />
                <Link
                  href={`/tracking/${r.code}`}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-navy hover:border-star"
                >
                  Open
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function fmtDue(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60));
  if (diff < 0) return `${Math.abs(diff)}h ago`;
  if (diff < 24) return `in ${diff}h`;
  return fmtShortDate(iso);
}
