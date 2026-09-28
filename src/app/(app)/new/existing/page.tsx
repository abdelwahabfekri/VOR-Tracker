import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe, getProviders } from "@/lib/data";
import { ExistingReferralForm } from "@/components/ExistingReferralForm";

export default async function ExistingReferralPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/tracking");

  const providers = await getProviders();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/new" className="text-sm text-muted hover:text-navy">← New referral</Link>
      <header className="mb-6 mt-3">
        <h1 className="text-2xl font-semibold text-ink">Add existing referral</h1>
        <p className="mt-1 text-sm text-muted">
          For a referral already in progress outside the tracker. It is saved at its current stage — earlier steps are
          not recreated.
        </p>
      </header>
      <ExistingReferralForm providers={providers} />
    </div>
  );
}
