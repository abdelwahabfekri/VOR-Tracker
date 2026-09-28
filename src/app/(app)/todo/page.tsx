import { redirect } from "next/navigation";
import { getMe, getReferrals, getProviders } from "@/lib/data";
import { TodoBoard } from "@/components/TodoBoard";
import { PageHeader } from "@/components/ui";

export default async function TodoPage({
  searchParams,
}: {
  searchParams: { provider?: string };
}) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/tracking"); // viewers have no action queue

  const providerId = searchParams.provider || undefined;
  const [referrals, providers] = await Promise.all([
    getReferrals(providerId),
    getProviders(),
  ]);

  return (
    <div>
      <PageHeader
        title="To-Do"
        description="Calls and record chases due now. Log an outcome to advance the referral."
      />
      <TodoBoard referrals={referrals} providers={providers} activeProvider={providerId} />
    </div>
  );
}
