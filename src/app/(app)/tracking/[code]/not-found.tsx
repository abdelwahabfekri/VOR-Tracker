import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="text-3xl">🔍</div>
      <h1 className="mt-3 text-lg font-semibold text-ink">No referral with that code</h1>
      <p className="mt-1 text-sm text-muted">Check the tracking number, or go back to the list.</p>
      <Link href="/tracking" className="mt-5 inline-block rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">
        Back to tracking
      </Link>
    </div>
  );
}
