import { redirect } from "next/navigation";
import { getMe, getProviders } from "@/lib/data";
import { NewReferralForm } from "@/components/NewReferralForm";

export default async function NewReferralPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/tracking");

  const providers = await getProviders();

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">New referral</h1>
        <p className="mt-1 text-sm text-muted">
          Creates a tracking code. Copy it into the secured Excel sheet against the patient’s MRN.
        </p>
      </header>
      <NewReferralForm providers={providers} />
    </div>
  );
}
