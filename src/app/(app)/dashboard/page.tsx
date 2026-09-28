import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe, getDashboard } from "@/lib/data";
import { DashboardCharts } from "@/components/DashboardCharts";
import { Card, PageHeader, type CardTone } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { isActive, closedKind } from "@/lib/types";
import type { Referral } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const me = await getMe();
  if (!me) redirect("/login");

  const range = searchParams.range === "all" ? "all" : "active";
  const { referrals } = await getDashboard();
  const visible = range === "active" ? referrals.filter(isActive) : referrals;

  const now = Date.now();
  const activeReferrals = visible.filter(isActive);
  const dueNow = activeReferrals.filter((r) => r.next_action_due && new Date(r.next_action_due).getTime() <= now);
  const awaitingScheduling = activeReferrals.filter((r) =>
    ["referral_created", "patient_contacted", "awaiting_booking", "appointment_rescheduled"].includes(r.appointment_state)
  );
  const outstandingDocuments = activeReferrals.filter((r) =>
    ["records_request_due", "documents_requested", "documents_received"].includes(r.document_state)
  );
  const awaitingPatient = activeReferrals.filter((r) => r.appointment_state === "patient_not_replying");

  const cards: { label: string; value: number; tone: CardTone; num: string; icon: IconName }[] = [
    { label: "Active referrals", value: activeReferrals.length, tone: "appt", num: "text-appt", icon: "route" },
    { label: "Due now", value: dueNow.length, tone: "overdue", num: "text-overdue", icon: "alert" },
    { label: "Awaiting scheduling", value: awaitingScheduling.length, tone: "neutral", num: "text-navy", icon: "calendar" },
    { label: "Outstanding records", value: outstandingDocuments.length, tone: "docs", num: "text-docs", icon: "file" },
    { label: "Unable to reach patient", value: awaitingPatient.length, tone: "soon", num: "text-soon", icon: "userX" },
  ];

  // Success-vs-incomplete breakdown (Task 4.2)
  const kinds = visible.map(closedKind);
  const completed = kinds.filter((k) => k === "completed").length;
  const incomplete = kinds.filter((k) => k === "incomplete").length;
  const declinedOrCancelled = kinds.filter((k) => k === "declined" || k === "cancelled").length;

  // Avg completion time — successfully completed referrals only (Task 4.3)
  const completedReferrals = visible.filter((r): r is Referral & { closed_at: string } =>
    closedKind(r) === "completed" && !!r.closed_at
  );
  const avgDays =
    completedReferrals.length > 0
      ? Math.round(
          (completedReferrals.reduce(
            (sum, r) => sum + (new Date(r.closed_at).getTime() - new Date(r.referral_date).getTime()),
            0
          ) /
            completedReferrals.length /
            (1000 * 60 * 60 * 24)) *
            10
        ) / 10
      : null;

  const showClosures = range === "all";

  return (
    <div>
      <PageHeader title="Dashboard" description="Operational metrics across referrals.">
        <div role="tablist" aria-label="Range" className="flex rounded-ctl bg-white p-1 shadow-surface ring-1 ring-inset ring-line">
          <RangeLink range="active" current={range}>Active</RangeLink>
          <RangeLink range="all" current={range}>All time</RangeLink>
        </div>
      </PageHeader>

      {/* Stat cards — the number is the strongest element */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c, i) => (
          <div key={c.label} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <Card tone={c.tone} className="h-full p-4">
              <div className="flex items-start justify-between">
                <div className={`text-[34px] font-bold leading-none tracking-tight ${c.num}`}>{c.value}</div>
                <Icon name={c.icon} className={`h-4 w-4 ${c.num} opacity-70`} />
              </div>
              <div className="mt-2 text-xs font-medium text-muted">{c.label}</div>
            </Card>
          </div>
        ))}
      </div>

      {/* Closure metrics only make sense when closed referrals are in range */}
      {showClosures ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card className="p-5 md:col-span-2">
            <div className="eyebrow mb-3">How referrals closed · all time</div>
            <div className="grid grid-cols-3 gap-4">
              <Closure n={completed} label="Completed" cls="text-done" />
              <Closure n={incomplete} label="Incomplete" cls="text-overdue" />
              <Closure n={declinedOrCancelled} label="Declined / Cancelled" cls="text-slate" />
            </div>
          </Card>
          <Card className="flex flex-col justify-center p-5" tone="done">
            <div className="text-[30px] font-bold leading-none text-navy">{avgDays ?? "—"}</div>
            <div className="mt-2 text-xs text-muted">avg days to completion (successful referrals)</div>
          </Card>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Icon name="info" className="h-3.5 w-3.5" />
          Showing active referrals only. Switch to <Link href="/dashboard?range=all" className="font-semibold text-navy hover:underline">All time</Link> for closure outcomes and completion time.
        </p>
      )}

      {/* Charts */}
      <div className="mt-6">
        <DashboardCharts referrals={visible} showClosures={showClosures} />
      </div>
    </div>
  );
}

function Closure({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div>
      <div className={`text-[28px] font-bold leading-none ${cls}`}>{n}</div>
      <div className="mt-1.5 text-xs text-muted">{label}</div>
    </div>
  );
}

function RangeLink({ range, current, children }: { range: "active" | "all"; current: string; children: React.ReactNode }) {
  const active = range === current;
  return (
    <Link
      href={`/dashboard?range=${range}`}
      role="tab"
      aria-selected={active}
      className={`rounded-[9px] px-3.5 py-1.5 text-sm font-medium transition duration-fast ${
        active ? "bg-primary text-white shadow-surface" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
