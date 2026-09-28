import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe, getProviders } from "@/lib/data";
import { NewReferralForm } from "@/components/NewReferralForm";
import { PageHeader } from "@/components/ui";

export default async function NewReferralPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/tracking");

  const providers = await getProviders();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New Referral"
        description={
          <>
            Creates a tracking code for the patient’s referral.{" "}
            <Link href="/new/existing" className="font-semibold text-navy underline-offset-2 hover:underline">
              Already in progress? Add existing referral
            </Link>
          </>
        }
      />
      <NewReferralForm providers={providers} />
    </div>
  );
}
