"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Referral } from "@/lib/types";
import { isActive } from "@/lib/types";
import { performAction } from "@/lib/actions";
import { nextActionLabel } from "@/lib/statusEngine";
import { QuickActions } from "@/components/QuickActions";
import { Card } from "@/components/ui";
import type { Action } from "@/lib/statusEngine";

export function DetailActions({ referral }: { referral: Referral }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const closed = !isActive(referral);

  async function run(action: Action, note?: string): Promise<boolean> {
    setPending(true);
    const res = await performAction(referral.id, referral.updated_at, action, "outbound", note);
    setPending(false);
    if (!res.ok) {
      // keep the error up until the next attempt — no fake success
      setMsg({ ok: false, text: res.error ?? "Could not save. Try again." });
      return false;
    }
    setMsg({ ok: true, text: "Logged." });
    router.refresh();
    setTimeout(() => setMsg(null), 2500);
    return true;
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Next action</h2>
        {msg && <span className={`text-xs ${msg.ok ? "text-docs" : "text-overdue"}`}>{msg.text}</span>}
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
