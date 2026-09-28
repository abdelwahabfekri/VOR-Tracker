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
import { Card, PageHeader, EmptyState } from "@/components/ui";

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
    return <Card><EmptyState icon="user" title="No active internal providers">Add or reactivate a provider to build a report.</EmptyState></Card>;
  }

  const referrals = await getReferrals(provider.id);
  const history = await getHistoryForReferrals(referrals.map((r) => r.id));
  const rows = buildReportRows(referrals, history, period);
  const opts = { showChange };

  return (
    <div>
      <PageHeader
        title="Weekly Reports"
        description="One report per internal provider. Review, copy, and send it yourself from Outlook — this app never sends email."
      />
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
