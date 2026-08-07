import { redirect } from "next/navigation";
import { getMe, getReferrals, getProviders } from "@/lib/data";
import { TrackingTable } from "@/components/TrackingTable";

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: { provider?: string };
}) {
  const me = await getMe();
  if (!me) redirect("/login");

  const providerId = searchParams.provider || undefined;
  const [referrals, providers] = await Promise.all([
    getReferrals(providerId),
    getProviders(),
  ]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Tracking</h1>
        <p className="mt-1 text-sm text-muted">
          Every referral and where it stands. Select a row to see its full journey.
        </p>
      </header>
      <TrackingTable referrals={referrals} providers={providers} activeProvider={providerId} />
    </div>
  );
}
