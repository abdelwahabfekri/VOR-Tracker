"use client";

import { Card } from "@/components/ui";

// Shown when a page's data failed to load (connection, permission, schema).
// Distinct from an empty list: nothing here means "there are no referrals".
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <div className="text-2xl text-overdue">!</div>
      <h1 className="mt-2 text-lg font-semibold text-ink">Could not load this page</h1>
      <p className="mt-1 text-sm text-muted">
        The data didn’t load — this is not the same as having no referrals. Check your connection and try again.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-navy hover:border-star"
        >
          Reload page
        </button>
      </div>
    </Card>
  );
}
