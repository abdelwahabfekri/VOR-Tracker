import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe, getDashboard } from "@/lib/data";
import { DashboardCharts } from "@/components/DashboardCharts";
import { Card } from "@/components/ui";
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
    ["documents_requested", "documents_received"].includes(r.document_state)
  );
  const awaitingPatient = activeReferrals.filter((r) => r.appointment_state === "patient_not_replying");

  const cards = [
    { label: "Active referrals", value: activeReferrals.length, tone: "text-appt" },
    { label: "Due now", value: dueNow.length, tone: "text-overdue" },
    { label: "Awaiting scheduling", value: awaitingScheduling.length, tone: "text-ink" },
    { label: "Outstanding records", value: outstandingDocuments.length, tone: "text-docs" },
    { label: "Awaiting patient", value: awaitingPatient.length, tone: "text-soon" },
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

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Operational metrics across referrals.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-1 text-sm">
          <RangeLink range="active" current={range}>Active</RangeLink>
          <RangeLink range="all" current={range}>All time</RangeLink>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className={`text-3xl font-bold ${c.tone}`}>{c.value}</div>
            <div className="mt-1 text-xs text-muted">{c.label}</div>
          </Card>
        ))}
      </div>

      {/* Completion breakdown */}
      <Card className="mt-4 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">How referrals closed</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold text-done">{completed}</div>
            <div className="mt-0.5 text-xs text-muted">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-overdue">{incomplete}</div>
            <div className="mt-0.5 text-xs text-muted">Incomplete</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-muted">{declinedOrCancelled}</div>
            <div className="mt-0.5 text-xs text-muted">Declined / Cancelled</div>
          </div>
        </div>
      </Card>

      {avgDays != null && (
        <Card className="mt-4 flex items-center gap-3 p-4">
          <div className="text-2xl font-bold text-navy">{avgDays}</div>
          <div className="text-sm text-muted">avg days to completion (successful referrals)</div>
        </Card>
      )}

      {/* Charts */}
      <div className="mt-6">
        <DashboardCharts referrals={visible} />
      </div>
    </div>
  );
}

function RangeLink({ range, current, children }: { range: "active" | "all"; current: string; children: React.ReactNode }) {
  const active = range === current;
  return (
    <Link
      href={`/dashboard?range=${range}`}
      className={`rounded-md px-3 py-1.5 font-medium transition ${
        active ? "bg-navy text-white" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
