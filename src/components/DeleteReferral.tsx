"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Referral } from "@/lib/types";
import { deleteReferral } from "@/lib/actions";
import { Card, InlineError, Spinner } from "@/components/ui";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";

export function DeleteReferral({ referral }: { referral: Referral }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setTyped("");
    setError(null);
  }

  function confirm(e: React.FormEvent) {
    e.preventDefault();
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
    <Card className="border-overdue/25 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-ctl bg-overdue-soft text-overdue">
            <Icon name="trash" className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-overdue">Danger zone</h2>
            <p className="text-sm text-muted">Permanently delete this referral and its history. This cannot be undone.</p>
          </div>
        </div>
        <button className="btn btn-danger" onClick={() => setOpen(true)}>
          <Icon name="trash" className="h-4 w-4" />
          Delete referral
        </button>
      </div>

      <Dialog
        open={open}
        onClose={close}
        title="Delete this referral?"
        description={<>The referral, its journey and its full history are removed for everyone. <strong className="text-ink">This cannot be undone.</strong></>}
      >
        <form onSubmit={confirm} className="space-y-4">
          <div>
            <label htmlFor="confirm-code" className="field-label">
              Type <span className="num font-semibold">{referral.code}</span> to confirm
            </label>
            <input
              id="confirm-code"
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(e) => { setTyped(e.target.value); setError(null); }}
              placeholder={referral.code}
              className="field num focus:border-overdue"
            />
          </div>
          <InlineError>{error}</InlineError>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={close}>Keep referral</button>
            <button type="submit" className="btn btn-danger-solid" disabled={pending || typed !== referral.code}>
              {pending ? <><Spinner className="h-3.5 w-3.5" /> Deleting…</> : <><Icon name="trash" className="h-4 w-4" /> Delete permanently</>}
            </button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
