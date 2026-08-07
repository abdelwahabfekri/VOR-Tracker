import { redirect } from "next/navigation";
import { getMe, getReferrals, getProviders } from "@/lib/data";
import { TodoBoard } from "@/components/TodoBoard";

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
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">To-Do</h1>
        <p className="mt-1 text-sm text-muted">
          Calls and record chases due now. Log an outcome to advance the referral.
        </p>
      </header>
      <TodoBoard referrals={referrals} providers={providers} activeProvider={providerId} />
    </div>
  );
}
