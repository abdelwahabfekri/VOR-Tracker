"use client";

import { useState } from "react";
import type { Referral } from "@/lib/types";
import type { Action } from "@/lib/statusEngine";
import { isoToNyInput, nyInputToIso } from "@/lib/tz";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { Spinner } from "@/components/ui";

// Presents only the actions that make sense for the referral's current state
// (the server re-checks every one). One primary action, the rest secondary.
// Every action can carry an optional free-text note, stored on its
// status_history entry and shown to admins and to doctors allowed to see the
// referral.
//   onAction resolves true on success; typed input is kept on failure so the
//   user can retry.
//
// Major milestones also require the user to confirm the patient's eCW note is
// updated before the action is saved (the tracker cannot write to eCW itself).
type Prompt = null | "book" | "reschedule" | "decline" | "followup" | "ecw";

export const ECW_NOTE_ACTIONS: ReadonlySet<Action["kind"]> = new Set<Action["kind"]>([
  "book_appointment", // Scheduled
  "mark_completed",   // Visit completed
  "doc_received",     // Records received
  "close",            // Filed & closed
  "patient_declined", // journey ended
  "cancel",           // journey ended
]);

type Btn = {
  label: string;
  kind: "primary" | "secondary" | "danger";
  run: () => void;
};

export function QuickActions({
  referral,
  onAction,
  disabled,
  compact,
}: {
  referral: Referral;
  onAction: (a: Action, note?: string) => Promise<boolean>;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [ecwPending, setEcwPending] = useState<{ label: string; action: Action } | null>(null);
  const a = referral.appointment_state;
  const d = referral.document_state;

  // Fire an instant action using whatever note is currently typed; clear it on success.
  async function fire(label: string, action: Action) {
    setBusy(label);
    const ok = await onAction(action, note.trim() || undefined);
    setBusy(null);
    if (ok) setNote("");
  }

  // Close an open prompt only once its action succeeded.
  async function fromPrompt(action: Action, n?: string): Promise<boolean> {
    const ok = await onAction(action, n);
    if (ok) setPrompt(null);
    return ok;
  }

  const instant = (label: string, kind: Btn["kind"], action: Action): Btn => ({
    label,
    kind,
    run: () => {
      if (!ECW_NOTE_ACTIONS.has(action.kind)) return void fire(label, action);
      setEcwPending({ label, action });
      setPrompt("ecw");
    },
  });
  const open = (label: string, kind: Btn["kind"], p: Exclude<Prompt, null>): Btn => ({ label, kind, run: () => setPrompt(p) });

  let buttons: Btn[] = [];
  if (a === "referral_created" || a === "patient_contacted" || a === "awaiting_booking") {
    buttons = [
      open("Booked", "primary", "book"),
      instant("Awaiting Booking", "secondary", { kind: "awaiting_booking" }),
      instant("No Answer", "secondary", { kind: "log_no_answer" }),
      open("Declined", "danger", "decline"),
    ];
  } else if (a === "appointment_scheduled" || a === "appointment_rescheduled") {
    // Once the slot has passed without a confirmation (pre-call unanswered),
    // the post-visit outcomes are offered instead.
    const slotPassed = !!referral.appointment_slot && new Date(referral.appointment_slot).getTime() <= Date.now();
    buttons = slotPassed
      ? [instant("Visit Done", "primary", { kind: "mark_completed" }), instant("No-Show", "secondary", { kind: "mark_no_show" })]
      : [instant("Confirmed", "primary", { kind: "confirm_attendance" }), instant("No Answer", "secondary", { kind: "precall_no_answer" })];
    buttons.push(open("Reschedule", "secondary", "reschedule"));
  } else if (a === "appointment_confirmed") {
    buttons = [
      instant("Visit Done", "primary", { kind: "mark_completed" }),
      open("Rescheduled", "secondary", "reschedule"),
      instant("No-Show", "secondary", { kind: "mark_no_show" }),
    ];
  } else if (a === "patient_not_replying") {
    buttons = [instant("Re-engage", "primary", { kind: "reopen_contact" }), instant("Cancel Referral", "danger", { kind: "cancel" })];
  } else if (a === "appointment_completed") {
    if (d === "records_request_due") {
      // "Records Requested" only once the office was actually reached and asked.
      // Couldn't reach them -> set when to try again; the status stays.
      buttons = [
        instant("Records Requested", "primary", { kind: "records_requested" }),
        open("Couldn’t Reach — Set Follow-Up", "secondary", "followup"),
      ];
    } else if (d === "documents_requested") {
      buttons = [instant("Records In", "primary", { kind: "doc_received" }), instant("No Response", "secondary", { kind: "doc_chase_no_response" })];
    } else if (d === "documents_received") {
      buttons = [instant("Uploaded to eCW", "primary", { kind: "doc_uploaded" })];
    } else if (d === "documents_uploaded") {
      buttons = [instant("Close Referral", "primary", { kind: "close" })];
    }
  }

  if (buttons.length === 0) return <span className="text-xs text-muted">No action</span>;

  const cls: Record<Btn["kind"], string> = {
    primary: "btn btn-primary",
    secondary: "btn btn-secondary",
    danger: "btn btn-danger",
  };
  const size = compact ? "btn-sm" : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map((b) => (
        <button key={b.label} className={`${cls[b.kind]} ${size}`} disabled={disabled} onClick={b.run}>
          {busy === b.label && <Spinner className="h-3.5 w-3.5" />}
          {b.label}
          {b.kind === "primary" && busy !== b.label && <Icon name="arrowRight" className="btn-icon h-3.5 w-3.5" />}
        </button>
      ))}
      <label className="sr-only" htmlFor={`note-${referral.id}`}>Note for this action (optional)</label>
      <input
        id={`note-${referral.id}`}
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        className={`field ${compact ? "field-sm" : "py-2"} w-full min-w-[180px] sm:w-56`}
      />

      <Dialog
        open={prompt === "book" || prompt === "reschedule"}
        onClose={() => setPrompt(null)}
        title={prompt === "reschedule" ? "Reschedule Appointment" : "Book Appointment"}
        description="The confirmation call is scheduled 24 hours before the appointment."
      >
        <SlotForm
          confirmLabel={prompt === "reschedule" ? "Save New Date" : "Book Appointment"}
          ecwCheck={prompt === "book"}
          onPick={(slot, n) => fromPrompt(prompt === "reschedule" ? { kind: "reschedule", slot } : { kind: "book_appointment", slot }, n)}
          onCancel={() => setPrompt(null)}
        />
      </Dialog>

      <Dialog
        open={prompt === "followup"}
        onClose={() => setPrompt(null)}
        title="Set Next Follow-Up"
        description="The records status stays “Records request needed”; only the follow-up date moves."
      >
        <SlotForm
          confirmLabel="Set Follow-Up"
          warnPast
          onPick={(due, n) => fromPrompt({ kind: "set_followup", due }, n)}
          onCancel={() => setPrompt(null)}
        />
      </Dialog>

      <Dialog
        open={prompt === "decline"}
        onClose={() => setPrompt(null)}
        title="Patient Declined"
        description="This closes the referral as Declined. It can be undone later only with Correct status."
      >
        <ReasonForm
          confirmLabel="Confirm Decline"
          ecwCheck
          onConfirm={(reason) => fromPrompt({ kind: "patient_declined" }, reason)}
          onCancel={() => setPrompt(null)}
        />
      </Dialog>

      <Dialog
        open={prompt === "ecw"}
        onClose={() => setPrompt(null)}
        title="Update eCW Note"
        description="This is a major milestone. Update the patient’s note in eCW before saving it here."
      >
        <EcwConfirmForm
          confirmLabel={ecwPending ? `Save: ${ecwPending.label}` : "Save"}
          danger={ecwPending?.action.kind === "cancel"}
          onConfirm={async () => {
            if (!ecwPending) return false;
            const ok = await onAction(ecwPending.action, note.trim() || undefined);
            if (ok) {
              setNote("");
              setPrompt(null);
              setEcwPending(null);
            }
            return ok;
          }}
          onCancel={() => setPrompt(null)}
        />
      </Dialog>
    </div>
  );
}

// Required acknowledgement on every major-milestone save.
function EcwCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 rounded-ctl bg-soon-soft px-3 py-2 text-sm text-soon">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>I’ve updated the patient’s note in eCW for this milestone.</span>
    </label>
  );
}

function EcwConfirmForm({
  onConfirm,
  onCancel,
  confirmLabel,
  danger,
}: {
  onConfirm: () => Promise<boolean>;
  onCancel: () => void;
  confirmLabel: string;
  danger?: boolean;
}) {
  const [ack, setAck] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ack) return;
    setPending(true);
    await onConfirm();
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <EcwCheck checked={ack} onChange={setAck} />
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className={danger ? "btn btn-danger-solid" : "btn btn-primary"} disabled={!ack || pending}>
          {pending ? <><Spinner className="h-3.5 w-3.5" /> Saving…</> : confirmLabel}
        </button>
      </div>
    </form>
  );
}

function SlotForm({
  onPick,
  onCancel,
  initial = "",
  confirmLabel = "Set",
  warnPast,
  ecwCheck,
}: {
  onPick: (slot: string, note?: string) => Promise<boolean>;
  onCancel: () => void;
  initial?: string;
  confirmLabel?: string;
  warnPast?: boolean;
  ecwCheck?: boolean;
}) {
  const [val, setVal] = useState(initial ? isoToNyInput(initial) : "");
  const [note, setNote] = useState("");
  const [ackPast, setAckPast] = useState(false);
  const [ackEcw, setAckEcw] = useState(false);
  const [pending, setPending] = useState(false);
  const inPast = warnPast && !!val && new Date(nyInputToIso(val)).getTime() < Date.now();
  const blocked = !val || (inPast && !ackPast) || (ecwCheck && !ackEcw);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (blocked) return;
    setPending(true);
    await onPick(nyInputToIso(val), note.trim() || undefined);
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="slot-when">Date and time</label>
        <input id="slot-when" type="datetime-local" value={val} onChange={(e) => { setVal(e.target.value); setAckPast(false); }} className="field" required autoFocus />
      </div>
      <div>
        <label className="field-label" htmlFor="slot-note">Note <span className="font-normal text-muted">(optional)</span></label>
        <input id="slot-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} className="field" placeholder="e.g. Office asked to call back Monday" />
      </div>
      {inPast && (
        <label className="flex items-center gap-2 rounded-ctl bg-soon-soft px-3 py-2 text-sm text-soon">
          <input type="checkbox" checked={ackPast} onChange={(e) => setAckPast(e.target.checked)} />
          That date is in the past — the referral will show as overdue right away.
        </label>
      )}
      {ecwCheck && <EcwCheck checked={ackEcw} onChange={setAckEcw} />}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={blocked || pending}>
          {pending ? <><Spinner className="h-3.5 w-3.5" /> Saving…</> : confirmLabel}
        </button>
      </div>
    </form>
  );
}

function ReasonForm({
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  ecwCheck,
}: {
  onConfirm: (reason?: string) => Promise<boolean>;
  onCancel: () => void;
  confirmLabel?: string;
  ecwCheck?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [ackEcw, setAckEcw] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ecwCheck && !ackEcw) return;
    setPending(true);
    await onConfirm(reason.trim() || undefined);
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="reason">Reason <span className="font-normal text-muted">(optional)</span></label>
        <input id="reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="field" autoFocus />
      </div>
      {ecwCheck && <EcwCheck checked={ackEcw} onChange={setAckEcw} />}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-danger-solid" disabled={pending || (ecwCheck && !ackEcw)}>
          {pending ? <><Spinner className="h-3.5 w-3.5" /> Saving…</> : confirmLabel}
        </button>
      </div>
    </form>
  );
}
