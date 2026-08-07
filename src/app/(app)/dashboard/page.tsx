import { redirect } from "next/navigation";
import { getMe, getDashboard } from "@/lib/data";
import { DashboardCharts } from "@/components/DashboardCharts";
import { Card } from "@/components/ui";

export default async function DashboardPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  const { summary, providerStats, referrals } = await getDashboard();

  const cards = [
    { label: "Active referrals", value: summary?.active_referrals ?? 0, tone: "text-appt" },
    { label: "Due now", value: summary?.due_now ?? 0, tone: "text-overdue" },
    { label: "Awaiting scheduling", value: summary?.awaiting_scheduling ?? 0, tone: "text-ink" },
    { label: "Outstanding records", value: summary?.outstanding_documents ?? 0, tone: "text-docs" },
    { label: "Awaiting patient", value: summary?.awaiting_patient_response ?? 0, tone: "text-soon" },
    { label: "Completed", value: summary?.completed_referrals ?? 0, tone: "text-done" },
  ];

  const avgDays = summary?.avg_completion_days != null
    ? Math.round(Number(summary.avg_completion_days) * 10) / 10
    : null;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Operational metrics across all referrals.</p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className={`text-3xl font-bold ${c.tone}`}>{c.value}</div>
            <div className="mt-1 text-xs text-muted">{c.label}</div>
          </Card>
        ))}
      </div>

      {avgDays != null && (
        <Card className="mt-4 flex items-center gap-3 p-4">
          <div className="text-2xl font-bold text-navy">{avgDays}</div>
          <div className="text-sm text-muted">average days from referral to closed</div>
        </Card>
      )}

      {/* Charts */}
      <div className="mt-6">
        <DashboardCharts providerStats={providerStats} referrals={referrals} />
      </div>
    </div>
  );
}
