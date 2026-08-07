"use client";

import { useState } from "react";
import type { Referral } from "@/lib/types";
import type { Action } from "@/lib/statusEngine";

// Presents only the actions that make sense for the referral's current state.
export function QuickActions({
  referral,
  onAction,
  disabled,
}: {
  referral: Referral;
  onAction: (a: Action) => void;
  disabled?: boolean;
}) {
  const [slotOpen, setSlotOpen] = useState<null | "book" | "reschedule" | "confirm">(null);
  const a = referral.appointment_state;
  const d = referral.document_state;

  const btn =
    "rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50";
  const primary = `${btn} bg-navy text-white hover:bg-navy-700`;
  const ghost = `${btn} border border-line text-navy hover:border-star`;
  const danger = `${btn} border border-overdue/30 text-overdue hover:bg-overdue-soft`;

  // Track 1 — scheduling phase
  if (a === "referral_created" || a === "patient_contacted" || a === "awaiting_booking") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} disabled={disabled} onClick={() => setSlotOpen("book")}>Booked</button>
        <button className={ghost} disabled={disabled} onClick={() => onAction({ kind: "awaiting_booking" })}>Awaiting booking</button>
        <button className={ghost} disabled={disabled} onClick={() => onAction({ kind: "log_no_answer" })}>No answer</button>
        <button className={danger} disabled={disabled} onClick={() => onAction({ kind: "patient_declined" })}>Declined</button>
        {slotOpen === "book" && (
          <SlotPrompt onPick={(slot) => { onAction({ kind: "book_appointment", slot }); setSlotOpen(null); }} onCancel={() => setSlotOpen(null)} />
        )}
      </div>
    );
  }

  // Track 1 — pre-appointment confirmation
  if (a === "appointment_scheduled" || a === "appointment_rescheduled") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} disabled={disabled} onClick={() => setSlotOpen("confirm")}>Confirmed</button>
        <button className={ghost} disabled={disabled} onClick={() => onAction({ kind: "precall_no_answer" })}>No answer</button>
        <button className={ghost} disabled={disabled} onClick={() => setSlotOpen("reschedule")}>Reschedule</button>

        {slotOpen === "confirm" && (
          <SlotPrompt
            initial={referral.appointment_slot ?? ""}
            confirmLabel="Confirm"
            onPick={(slot) => { onAction({ kind: "confirm_attendance", slot }); setSlotOpen(null); }}
            onCancel={() => setSlotOpen(null)}
          />
        )}
        {slotOpen === "reschedule" && (
          <SlotPrompt
            onPick={(slot) => { onAction({ kind: "reschedule", slot }); setSlotOpen(null); }}
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
        <button className={primary} disabled={disabled} onClick={() => onAction({ kind: "mark_completed" })}>Visit done</button>
        <button className={ghost} disabled={disabled} onClick={() => setSlotOpen("reschedule")}>Rescheduled</button>
        <button className={ghost} disabled={disabled} onClick={() => onAction({ kind: "mark_no_show" })}>No-show</button>
        {slotOpen === "reschedule" && (
          <SlotPrompt onPick={(slot) => { onAction({ kind: "reschedule", slot }); setSlotOpen(null); }} onCancel={() => setSlotOpen(null)} />
        )}
      </div>
    );
  }

  // Parked — unreachable patient
  if (a === "patient_not_replying") {
    return (
      <div className="flex items-center gap-2">
        <button className={primary} disabled={disabled} onClick={() => onAction({ kind: "reopen_contact" })}>Re-engage</button>
        <button className={danger} disabled={disabled} onClick={() => onAction({ kind: "cancel" })}>Cancel</button>
      </div>
    );
  }

  // Track 2 — documents
  if (a === "appointment_completed") {
    if (d === "documents_requested") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button className={primary} disabled={disabled} onClick={() => onAction({ kind: "doc_received" })}>Records in</button>
          <button className={ghost} disabled={disabled} onClick={() => onAction({ kind: "doc_chase_no_response" })}>No response</button>
        </div>
      );
    }
    if (d === "documents_received") {
      return <button className={primary} disabled={disabled} onClick={() => onAction({ kind: "doc_uploaded" })}>Uploaded to eCW</button>;
    }
    if (d === "documents_uploaded") {
      return <button className={primary} disabled={disabled} onClick={() => onAction({ kind: "close" })}>Close referral</button>;
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
  onPick: (slot: string) => void;
  onCancel: () => void;
  initial?: string;   // ISO string to prefill (confirmation case)
  confirmLabel?: string;
}) {
  // Convert ISO to datetime-local format (no seconds/timezone).
  const toLocalInput = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  };

  const [val, setVal] = useState(toLocalInput(initial));

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="datetime-local"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-star"
      />
      <button
        className="rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        disabled={!val}
        onClick={() => onPick(new Date(val).toISOString())}
      >
        {confirmLabel}
      </button>
      <button className="text-xs text-muted hover:text-ink" onClick={onCancel}>✕</button>
    </div>
  );
}
