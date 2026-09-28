"use client";

import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";

// Shown when a page's data failed to load (connection, permission, schema).
// Distinct from an empty list: nothing here means "there are no referrals".
// Never echoes the error text — it could carry query values.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card className="mx-auto max-w-lg overflow-hidden" tone="overdue">
      <div role="alert" className="p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-overdue shadow-surface">
          <Icon name="alert" className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink">Could not load this page</h1>
        <p className="mt-1 text-sm text-muted">
          The data didn’t load — this is not the same as having no referrals. Check your connection and try again.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="btn btn-primary">
            <Icon name="refresh" className="h-4 w-4" /> Try again
          </button>
          <button onClick={() => window.location.reload()} className="btn btn-secondary">
            Reload page
          </button>
        </div>
      </div>
    </Card>
  );
}
