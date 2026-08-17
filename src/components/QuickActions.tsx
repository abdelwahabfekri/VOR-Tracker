"use client";

import { useState } from "react";
import type { Referral } from "@/lib/types";
import type { Action } from "@/lib/statusEngine";
import { isoToNyInput, nyInputToIso } from "@/lib/tz";

// Presents only the actions that make sense for the referral's current state.
// Every action can carry an optional free-text note, stored on that one
// status_history entry (admin-only — never surfaced to viewer UI).
export function QuickActions({
  referral,
  onAction,
  disabled,
}: {
  referral: Referral;
  onAction: (a: Action, note?: string) => void;
  disabled?: boolean;
}) {
  const [slotOpen, setSlotOpen] = useState<null | "book" | "reschedule" | "decline">(null);
  const [note, setNote] = useState("");
  const a = referral.appointment_state;
  const d = referral.document_state;

  const btn =
    "rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50";
  const primary = `${btn} bg-navy text-white hover:bg-navy-700`;
  const ghost = `${btn} border border-line text-navy hover:border-star`;
  const danger = `${btn} border border-overdue/30 text-overdue hover:bg-overdue-soft`;

  // Fire an instant action using whatever note is currently typed, then clear it.
  function fire(action: Action) {
    onAction(action, note.trim() || undefined);
    setNote("");
  }

  const noteField = (
    <input
      type="text"
      value={note}
      onChange={(e) => setNote(e.target.value)}
      placeholder="Add a note (optional)"
      className="w-full min-w-[200px] rounded-lg border border-line px-2.5 py-1.5 text-xs outline-none focus:border-star sm:w-56"
    />
  );

  // Track 1 — scheduling phase
  if (a === "referral_created" || a === "patient_contacted" || a === "awaiting_booking") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} disabled={disabled} onClick={() => setSlotOpen("book")}>Booked</button>
        <button className={ghost} disabled={disabled} onClick={() => fire({ kind: "awaiting_booking" })}>Awaiting booking</button>
        <button className={ghost} disabled={disabled} onClick={() => fire({ kind: "log_no_answer" })}>No answer</button>
        <button className={danger} disabled={disabled} onClick={() => setSlotOpen("decline")}>Declined</button>
        {noteField}
        {slotOpen === "book" && (
          <SlotPrompt
            onPick={(slot, n) => { onAction({ kind: "book_appointment", slot }, n); setSlotOpen(null); }}
            onCancel={() => setSlotOpen(null)}
          />
        )}
        {slotOpen === "decline" && (
          <ReasonPrompt
            label="Reason"
            confirmLabel="Confirm decline"
            onConfirm={(reason) => { onAction({ kind: "patient_declined" }, reason); setSlotOpen(null); }}
            onCancel={() => setSlotOpen(null)}
          />
        )}
      </div>
    );
  }

  // Track 1 — pre-appointment confirmation
  if (a === "appointment_scheduled" || a === "appointment_rescheduled") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} disabled={disabled} onClick={() => fire({ kind: "confirm_attendance" })}>Confirmed</button>
        <button className={ghost} disabled={disabled} onClick={() => fire({ kind: "precall_no_answer" })}>No answer</button>
        <button className={ghost} disabled={disabled} onClick={() => setSlotOpen("reschedule")}>Reschedule</button>
        {noteField}

        {slotOpen === "reschedule" && (
          <SlotPrompt
            onPick={(slot, n) => { onAction({ kind: "reschedule", slot }, n); setSlotOpen(null); }}
            onCancel={() => setSlotOpen(null)}
          />
        )}
      </div>
    );
  }

  // Track 1 — post-appointment check
  if (a === "appointment_confirmed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} disabled={disabled} onClick={() => fire({ kind: "mark_completed" })}>Visit done</button>
        <button className={ghost} disabled={disabled} onClick={() => setSlotOpen("reschedule")}>Rescheduled</button>
        <button className={ghost} disabled={disabled} onClick={() => fire({ kind: "mark_no_show" })}>No-show</button>
        {noteField}
        {slotOpen === "reschedule" && (
          <SlotPrompt
            onPick={(slot, n) => { onAction({ kind: "reschedule", slot }, n); setSlotOpen(null); }}
            onCancel={() => setSlotOpen(null)}
          />
        )}
      </div>
    );
  }

  // Parked — unreachable patient
  if (a === "patient_not_replying") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} disabled={disabled} onClick={() => fire({ kind: "reopen_contact" })}>Re-engage</button>
        <button className={danger} disabled={disabled} onClick={() => fire({ kind: "cancel" })}>Cancel</button>
        {noteField}
      </div>
    );
  }

  // Track 2 — documents
  if (a === "appointment_completed") {
    if (d === "documents_requested") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button className={primary} disabled={disabled} onClick={() => fire({ kind: "doc_received" })}>Records in</button>
          <button className={ghost} disabled={disabled} onClick={() => fire({ kind: "doc_chase_no_response" })}>No response</button>
          {noteField}
        </div>
      );
    }
    if (d === "documents_received") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button className={primary} disabled={disabled} onClick={() => fire({ kind: "doc_uploaded" })}>Uploaded to eCW</button>
          {noteField}
        </div>
      );
    }
    if (d === "documents_uploaded") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button className={primary} disabled={disabled} onClick={() => fire({ kind: "close" })}>Close referral</button>
          {noteField}
        </div>
      );
    }
  }

  return <span className="text-xs text-muted">No action</span>;
}

function SlotPrompt({
  onPick,
  onCancel,
  initial = "",
  confirmLabel = "Set",
}: {
  onPick: (slot: string, note?: string) => void;
  onCancel: () => void;
  initial?: string;   // ISO string to prefill (confirmation case)
  confirmLabel?: string;
}) {
  const [val, setVal] = useState(initial ? isoToNyInput(initial) : "");
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="datetime-local"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-star"
      />
      <span className="text-[10px] font-medium text-muted" title="Eastern Time">ET</span>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        className="w-44 rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-star"
      />
      <button
        className="rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        disabled={!val}
        onClick={() => onPick(nyInputToIso(val), note.trim() || undefined)}
      >
        {confirmLabel}
      </button>
      <button className="text-xs text-muted hover:text-ink" onClick={onCancel}>✕</button>
    </div>
  );
}

function ReasonPrompt({
  onConfirm,
  onCancel,
  label,
  confirmLabel = "Confirm",
}: {
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  label: string;
  confirmLabel?: string;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`${label} (optional)`}
        className="w-56 rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-star"
        autoFocus
      />
      <button
        className="rounded-lg bg-overdue px-2.5 py-1.5 text-xs font-semibold text-white"
        onClick={() => onConfirm(reason.trim() || undefined)}
      >
        {confirmLabel}
      </button>
      <button className="text-xs text-muted hover:text-ink" onClick={onCancel}>✕</button>
    </div>
  );
}
