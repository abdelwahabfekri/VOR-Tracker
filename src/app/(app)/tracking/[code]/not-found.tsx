import Link from "next/link";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-md p-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-star-200/60 to-docs-soft text-navy">
        <Icon name="search" className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-ink">No Referral With That Code</h1>
      <p className="mt-1 text-sm text-muted">Check the tracking number, or search by MRN from the bar above.</p>
      <Link href="/tracking" className="btn btn-primary mt-6">
        Back to Tracking
      </Link>
    </Card>
  );
}
