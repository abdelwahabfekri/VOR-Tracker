"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Referral } from "@/lib/types";
import { isActive } from "@/lib/types";
import { performAction } from "@/lib/actions";
import { CAPS, followupKind, nextActionLabel, type Action } from "@/lib/statusEngine";
import { QuickActions } from "@/components/QuickActions";
import { Card, FollowupTag, AttemptBadge } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { missionIcon } from "@/lib/journey";
import { toast } from "@/components/Toast";
import { fmtDateTime } from "@/lib/tz";

// What the operator should do next, and the buttons to do it. Admins act
// here (outgoing call) or log a call the patient made to us (incoming);
// doctors see the same mission read-only.
const FLAG_TEXT: Record<string, string> = {
  reschedule_cap_review: "Reschedule limit reached — flagged for review.",
  parked_not_replying: "Moved to ‘Unable to reach patient’ — review needed.",
  documents_unavailable: "Marked records unavailable.",
};

export function DetailActions({ referral, isAdmin }: { referral: Referral; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"outbound" | "inbound">("outbound");
  const [saved, setSaved] = useState(0);

  const closed = !isActive(referral);
  const records = referral.appointment_state === "appointment_completed";
  const f = followupKind(referral);
  const a = referral.appointment_state;

  async function run(action: Action, note?: string): Promise<boolean> {
    setPending(true);
    const res = await performAction(referral.id, referral.updated_at, action, mode, note);
    setPending(false);
    if (!res.ok) {
      // stays up until dismissed — no fake success
      toast(res.error ?? "Could not save. Try again.", "error");
      return false;
    }
    if (res.flag && FLAG_TEXT[res.flag]) toast(FLAG_TEXT[res.flag], "warning");
    setSaved((n) => n + 1);
    setMode("outbound");
    // The journey above announces completed milestones once the page refreshes.
    router.refresh();
    return true;
  }

  if (closed) {
    return (
      <Card className="p-5 md:p-6" tone="neutral">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-soft text-slate">
            <Icon name="archive" className="h-5 w-5" />
          </span>
          <div>
            <div className="eyebrow">Current mission</div>
            <p className="font-semibold text-ink">No further action — this referral reached a final status.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 md:p-6" tone={f === "overdue" || f === "unreachable" ? "overdue" : records ? "docs" : "appt"}>
      <div className="flex flex-wrap items-start gap-4">
        <span
          key={nextActionLabel(referral)}
          className={`flex h-12 w-12 shrink-0 animate-fade-up items-center justify-center rounded-2xl text-white shadow-surface ${
            records ? "bg-track-docs" : "bg-track-appt"
          }`}
        >
          <Icon name={missionIcon(referral)} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Current mission</div>
          <p key={nextActionLabel(referral)} className="animate-fade-up text-lg font-semibold leading-snug text-ink">
            {nextActionLabel(referral)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="clock" className="h-3.5 w-3.5" />
              {referral.next_action_due ? <>Due <span className="text-ink">{fmtDateTime(referral.next_action_due)}</span></> : "No due date — waiting for review"}
            </span>
            {f && <FollowupTag kind={f} />}
            {["referral_created", "patient_contacted", "awaiting_booking"].includes(a) && (
              <AttemptBadge n={referral.contact_attempts} cap={CAPS.contact} label="Contact attempts" long />
            )}
            {referral.document_state === "documents_requested" && (
              <AttemptBadge n={referral.document_attempts} cap={CAPS.document} label="Records chases" long />
            )}
            {saved > 0 && (
              <span key={saved} className="inline-flex animate-fade-in items-center gap-1 text-xs font-medium text-docs">
                <Icon name="check" className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="mt-5 border-t border-line/70 pt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Who made the call" className="flex rounded-ctl bg-white/70 p-1 ring-1 ring-inset ring-line">
              <ModeButton active={mode === "outbound"} onClick={() => setMode("outbound")} icon="phoneOut">We called</ModeButton>
              <ModeButton active={mode === "inbound"} onClick={() => setMode("inbound")} icon="phoneIn">Patient called us</ModeButton>
            </div>
            <span className="text-xs text-muted">
              {mode === "inbound" ? "Logged as an incoming call — it can still advance the referral." : "Log what happened on this step."}
            </span>
          </div>
          <QuickActions referral={referral} onAction={run} disabled={pending} />
        </div>
      ) : (
        <p className="mt-4 rounded-ctl bg-white/70 px-3.5 py-2.5 text-sm text-muted ring-1 ring-inset ring-line">
          The Vision team handles this step. Progress appears on the journey above as soon as it is logged.
        </p>
      )}
    </Card>
  );
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: IconName; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-xs font-semibold transition duration-fast ${
        active ? "bg-white text-navy shadow-surface" : "text-muted hover:text-ink"
      }`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
