"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Referral } from "@/lib/types";
import { deleteReferral } from "@/lib/actions";
import { Card } from "@/components/ui";

export function DeleteReferral({ referral }: { referral: Referral }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await deleteReferral(referral.id, typed);
      if (!res.ok) {
        setError(res.error ?? "Failed to delete.");
        return;
      }
      router.push("/tracking");
    });
  }

  return (
    <Card className="border-overdue/30 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-overdue">Danger zone</h2>
      {!open ? (
        <div className="mt-3">
          <p className="mb-3 text-sm text-muted">Permanently delete this referral and its history. This cannot be undone.</p>
          <button
            className="rounded-lg border border-overdue/30 px-3 py-1.5 text-xs font-semibold text-overdue transition hover:bg-overdue-soft"
            onClick={() => setOpen(true)}
          >
            Delete referral
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted">
            Type <span className="font-mono font-semibold text-ink">{referral.code}</span> to confirm deletion.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={typed}
              onChange={(e) => { setTyped(e.target.value); setError(null); }}
              placeholder={referral.code}
              className="rounded-lg border border-line px-2 py-1.5 text-xs font-mono outline-none focus:border-overdue"
            />
            <button
              className="rounded-lg bg-overdue px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
              disabled={pending || typed !== referral.code}
              onClick={confirm}
            >
              {pending ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              className="text-xs text-muted hover:text-ink"
              onClick={() => { setOpen(false); setTyped(""); setError(null); }}
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-overdue">{error}</p>}
        </div>
      )}
    </Card>
  );
}
