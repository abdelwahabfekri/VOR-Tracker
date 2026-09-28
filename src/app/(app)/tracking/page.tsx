import { redirect } from "next/navigation";
import { getMe, getReferrals, getProviders } from "@/lib/data";
import { TrackingTable } from "@/components/TrackingTable";
import { PageHeader } from "@/components/ui";

// No search term is ever read from the URL: MRN filtering happens in the
// page (client-side, over rows RLS already allowed) and the global search
// uses a server action.
export default async function TrackingPage({
  searchParams,
}: {
  searchParams: { provider?: string; status?: string };
}) {
  const me = await getMe();
  if (!me) redirect("/login");

  const providerId = searchParams.provider || undefined;
  const activeStatus = searchParams.status === "closed" ? "closed" : "active";
  const [referrals, providers] = await Promise.all([
    getReferrals(providerId),
    getProviders(),
  ]);

  return (
    <div>
      <PageHeader
        title="Tracking"
        description="Every referral and where it stands. Open a row to see its full journey."
      />
      <TrackingTable
        referrals={referrals}
        providers={providers}
        activeProvider={providerId}
        activeStatus={activeStatus}
      />
    </div>
  );
}
