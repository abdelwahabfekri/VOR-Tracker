import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe, getProviders } from "@/lib/data";
import { ExistingReferralForm } from "@/components/ExistingReferralForm";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";

export default async function ExistingReferralPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/tracking");

  const providers = await getProviders();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/new" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy">
        <Icon name="arrowLeft" className="h-4 w-4" /> New referral
      </Link>
      <PageHeader
        title="Add existing referral"
        description="For a referral already in progress outside the tracker. It is saved at its current stage — earlier steps are not recreated."
      />
      <ExistingReferralForm providers={providers} />
    </div>
  );
}
