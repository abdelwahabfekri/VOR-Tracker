"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Referral } from "@/lib/types";
import { performAction } from "@/lib/actions";
import { nextActionLabel } from "@/lib/statusEngine";
import { QuickActions } from "@/components/QuickActions";
import { Card } from "@/components/ui";
import type { Action } from "@/lib/statusEngine";

export function DetailActions({ referral }: { referral: Referral }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const closed =
    referral.document_state === "closed" ||
    ["patient_declined", "cancelled"].includes(referral.appointment_state) ||
    referral.document_state === "documents_unavailable";

  function run(action: Action) {
    startTransition(async () => {
      const res = await performAction(referral.id, action);
      setMsg(res.ok ? "Logged." : res.error ?? "Error");
      router.refresh();
      setTimeout(() => setMsg(null), 2500);
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Next action</h2>
        {msg && <span className="text-xs text-docs">{msg}</span>}
      </div>
      {closed ? (
        <p className="mt-3 text-sm text-muted">This referral has reached a final state. No further action needed.</p>
      ) : (
        <div className="mt-3">
          <p className="mb-3 font-medium text-ink">{nextActionLabel(referral)}</p>
          <QuickActions referral={referral} onAction={run} disabled={pending} />
        </div>
      )}
    </Card>
  );
}
