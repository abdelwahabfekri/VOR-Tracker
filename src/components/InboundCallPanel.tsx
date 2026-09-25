"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Referral } from "@/lib/types";
import { isActive } from "@/lib/types";
import type { Action } from "@/lib/statusEngine";
import { performAction } from "@/lib/actions";
import { QuickActions } from "@/components/QuickActions";
import { Card } from "@/components/ui";

// Log a call the patient made TO you, any time while the referral is active.
// Uses the same state-appropriate quick actions, recorded as inbound.
export function InboundCallPanel({ referral }: { referral: Referral }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isActive(referral)) return null;

  async function run(action: Action, note?: string): Promise<boolean> {
    setPending(true);
    const res = await performAction(referral.id, referral.updated_at, action, "inbound", note);
    setPending(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error ?? "Could not save. Try again." });
      return false;
    }
    setMsg({ ok: true, text: "Incoming call logged." });
    setOpen(false);
    router.refresh();
    setTimeout(() => setMsg(null), 2500);
    return true;
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
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-docs" : "text-overdue"}`}>{msg.text}</p>}
    </Card>
  );
}
