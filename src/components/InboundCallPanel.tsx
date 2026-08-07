"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Referral } from "@/lib/types";
import type { Action } from "@/lib/statusEngine";
import { performAction } from "@/lib/actions";
import { QuickActions } from "@/components/QuickActions";
import { Card } from "@/components/ui";

// Log a call the patient made TO you, any time while the referral is active.
// Uses the same state-appropriate quick actions, recorded as inbound.
export function InboundCallPanel({ referral }: { referral: Referral }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const closed =
    referral.document_state === "closed" ||
    ["patient_declined", "cancelled"].includes(referral.appointment_state) ||
    referral.document_state === "documents_unavailable";

  if (closed) return null;

  function run(action: Action) {
    startTransition(async () => {
      const res = await performAction(referral.id, action, "inbound");
      setMsg(res.ok ? "Incoming call logged." : res.error ?? "Error");
      router.refresh();
      setOpen(false);
      setTimeout(() => setMsg(null), 2500);
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Incoming call</h2>
          <p className="mt-0.5 text-xs text-muted">Patient called you. Log the outcome — it can advance the referral.</p>
        </div>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-docs/40 px-3 py-1.5 text-xs font-semibold text-docs hover:bg-docs-soft"
          >
            ↓ Log patient call
          </button>
        ) : (
          <button onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink">Cancel</button>
        )}
      </div>

      {open && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-2 text-xs text-muted">Choose what the patient said:</p>
          <QuickActions referral={referral} onAction={run} disabled={pending} />
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-docs">{msg}</p>}
    </Card>
  );
}
