import { redirect } from "next/navigation";
import { getMe, getProviders, getReferrals, getHistoryForReferrals } from "@/lib/data";
import {
  buildReportRows,
  emailHtml,
  emailPlainText,
  makePeriod,
  periodLabel,
  reportSubject,
  tableHtml,
  tablePlainText,
  todayYmd,
} from "@/lib/weeklyReport";
import { WeeklyReportView } from "@/components/WeeklyReportView";
import { Card } from "@/components/ui";

export default async function WeeklyReportsPage({
  searchParams,
}: {
  searchParams: { provider?: string; start?: string; end?: string; change?: string };
}) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/tracking");

  const providers = await getProviders();
  const provider = providers.find((p) => p.id === searchParams.provider) ?? providers[0];
  const period = makePeriod(searchParams.start, searchParams.end);
  const showChange = searchParams.change !== "0";

  if (!provider) {
    return <Card className="p-8 text-center text-sm text-muted">No active internal providers.</Card>;
  }

  const referrals = await getReferrals(provider.id);
  const history = await getHistoryForReferrals(referrals.map((r) => r.id));
  const rows = buildReportRows(referrals, history, period);
  const opts = { showChange };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Weekly Reports</h1>
        <p className="mt-1 text-sm text-muted">
          One report per internal provider. Review, copy, and send it yourself from Outlook — this app never sends email.
        </p>
      </header>
      <WeeklyReportView
        providers={providers.map((p) => ({ id: p.id, name: p.name }))}
        provider={{ id: provider.id, name: provider.name, email: provider.report_email }}
        startYmd={period.startYmd}
        endYmd={period.endYmd}
        todayYmd={todayYmd()}
        periodText={periodLabel(period)}
        showChange={showChange}
        rowCount={rows.length}
        subject={reportSubject(provider.name, period)}
        email={{ html: emailHtml(provider.name, period, rows, opts), text: emailPlainText(provider.name, period, rows, opts) }}
        table={{ html: tableHtml(rows, opts), text: tablePlainText(rows, opts) }}
      />
    </div>
  );
}
