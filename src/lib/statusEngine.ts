// ============================================================================
// STATUS ENGINE — the single source of truth for state transitions,
// follow-up clocks, and attempt caps. Pure functions, no I/O, so it is
// easy to test and the UI just calls into it.
//
// Locked rules (from the SOP):
//   First contact:        24–48h after creation (this call = attempt 1)
//   Not scheduled:        every 3 days, max 5 attempts -> patient_not_replying
//   Pre-appointment call:  24h before slot
//   Post-appointment call: 24h after slot
//   Reschedule:           logged, cap 3 -> owner review
//   Documents chase:      every 5 days, max 3 attempts -> documents_unavailable
// ============================================================================

import type {
  Referral,
  AppointmentStatus,
  DocumentStatus,
  Track,
} from "./types";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export const CAPS = { contact: 5, reschedule: 3, document: 3 } as const;

// ---- Actions the admin can take ----------------------------------------
export type Action =
  // Track 1
  | { kind: "log_no_answer" }          // failed contact attempt (scheduling phase)
  | { kind: "book_appointment"; slot: string }
  | { kind: "confirm_attendance"; slot?: string }   // pre-call: confirm; optionally correct the slot
  | { kind: "precall_no_answer" }      // pre-call: couldn't reach -> status held
  | { kind: "mark_completed" }         // post-call: visit happened
  | { kind: "mark_no_show" }           // post-call: no-show -> silent revert
  | { kind: "reschedule"; slot: string }
  | { kind: "patient_declined" }
  | { kind: "cancel" }
  | { kind: "reopen_contact" }         // re-engage a parked (not-replying) referral
  // Track 2
  | { kind: "doc_chase_no_response" }  // failed records chase
  | { kind: "doc_received" }
  | { kind: "doc_uploaded" }
  | { kind: "close" };

export interface TransitionResult {
  appointment_state?: AppointmentStatus;
  document_state?: DocumentStatus;
  appointment_slot?: string | null;
  contact_attempts?: number;
  reschedule_count?: number;
  document_attempts?: number;
  next_action_due?: string | null;
  last_action_at: string;
  completed_at?: string | null;
  closed_at?: string | null;
  // for the history log
  log: { track: Track; from: string; to: string; note_code: string | null };
  // optional UI signal (e.g. a cap was hit and needs owner review)
  flag?: string;
}

// ---------------------------------------------------------------------------
// Compute the next_action_due for a freshly created referral.
// First contact window: due at +24h (overdue past +48h is handled by UI urgency).
// ---------------------------------------------------------------------------
export function initialDue(referralDate: Date = new Date()): string {
  return new Date(referralDate.getTime() + 24 * HOUR).toISOString();
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

// ---------------------------------------------------------------------------
// Apply an action to a referral, returning the field changes + a log entry.
// Throws on actions that don't make sense for the current state.
// ---------------------------------------------------------------------------
export function applyAction(r: Referral, action: Action): TransitionResult {
  const now = Date.now();
  const nowIso = iso(now);
  const a = r.appointment_state;
  const d = r.document_state;

  switch (action.kind) {
    // ---------------- Track 1: scheduling phase ----------------
    case "log_no_answer": {
      const attempts = r.contact_attempts + 1;
      if (attempts >= CAPS.contact) {
        return {
          appointment_state: "patient_not_replying",
          contact_attempts: attempts,
          next_action_due: null,
          last_action_at: nowIso,
          log: { track: "appointment", from: a, to: "patient_not_replying", note_code: "no_answer_cap" },
          flag: "parked_not_replying",
        };
      }
      return {
        appointment_state: a === "referral_created" ? "patient_contacted" : a,
        contact_attempts: attempts,
        next_action_due: iso(now + 3 * DAY), // every 3 days
        last_action_at: nowIso,
        log: { track: "appointment", from: a, to: "patient_contacted", note_code: "no_answer" },
      };
    }

    case "book_appointment": {
      const slotMs = new Date(action.slot).getTime();
      return {
        appointment_state: "appointment_scheduled",
        appointment_slot: action.slot,
        // pre-appointment confirmation call due 24h before the slot
        next_action_due: iso(slotMs - 24 * HOUR),
        last_action_at: nowIso,
        log: { track: "appointment", from: a, to: "appointment_scheduled", note_code: "booked" },
      };
    }

    // ---------------- Track 1: confirmation + visit ----------------
    case "confirm_attendance": {
      // If the user entered a corrected date at confirmation time, use and persist it;
      // otherwise fall back to the slot already booked.
      const confirmedSlot = action.slot ?? r.appointment_slot;
      const slotMs = confirmedSlot ? new Date(confirmedSlot).getTime() : now;
      return {
        appointment_state: "appointment_confirmed",
        appointment_slot: confirmedSlot,               // lock in the confirmed date
        // post-appointment completion check due 24h after the confirmed slot
        next_action_due: iso(slotMs + 24 * HOUR),
        last_action_at: nowIso,
        log: { track: "appointment", from: a, to: "appointment_confirmed", note_code: "confirmed" },
      };
    }

    case "precall_no_answer": {
      // Status held; resolve at post-appointment call. Keep due at +24h after slot.
      const slotMs = r.appointment_slot ? new Date(r.appointment_slot).getTime() : now;
      return {
        next_action_due: iso(slotMs + 24 * HOUR),
        last_action_at: nowIso,
        log: { track: "appointment", from: a, to: a, note_code: "precall_no_answer" },
      };
    }

    case "mark_completed": {
      // Track 1 ends; Track 2 activates.
      return {
        appointment_state: "appointment_completed",
        document_state: "documents_requested",
        completed_at: nowIso,
        next_action_due: iso(now + 5 * DAY), // first records chase window
        last_action_at: nowIso,
        log: { track: "appointment", from: a, to: "appointment_completed", note_code: "visit_done" },
      };
    }

    case "mark_no_show": {
      // Silent revert to the not-scheduled cycle (no distinct status).
      return {
        appointment_state: "patient_contacted",
        appointment_slot: null,
        next_action_due: iso(now + 3 * DAY),
        last_action_at: nowIso,
        log: { track: "appointment", from: a, to: "patient_contacted", note_code: "no_show" },
      };
    }

    case "reschedule": {
      const count = r.reschedule_count + 1;
      const slotMs = new Date(action.slot).getTime();
      const base: TransitionResult = {
        appointment_state: "appointment_rescheduled",
        appointment_slot: action.slot,
        reschedule_count: count,
        next_action_due: iso(slotMs - 24 * HOUR), // pre-call for the new slot
        last_action_at: nowIso,
        log: { track: "appointment", from: a, to: "appointment_rescheduled", note_code: "rescheduled" },
      };
      if (count >= CAPS.reschedule) base.flag = "reschedule_cap_review";
      return base;
    }

    case "patient_declined":
      return {
        appointment_state: "patient_declined",
        next_action_due: null,
        last_action_at: nowIso,
        closed_at: nowIso,
        log: { track: "appointment", from: a, to: "patient_declined", note_code: "declined" },
      };

    case "cancel":
      return {
        appointment_state: "cancelled",
        next_action_due: null,
        last_action_at: nowIso,
        closed_at: nowIso,
        log: { track: "appointment", from: a, to: "cancelled", note_code: "cancelled" },
      };

    case "reopen_contact":
      return {
        appointment_state: "patient_contacted",
        contact_attempts: 0,
        next_action_due: iso(now + 3 * DAY),
        last_action_at: nowIso,
        log: { track: "appointment", from: a, to: "patient_contacted", note_code: "reopened" },
      };

    // ---------------- Track 2: documents ----------------
    case "doc_chase_no_response": {
      const attempts = r.document_attempts + 1;
      if (attempts >= CAPS.document) {
        return {
          document_state: "documents_unavailable",
          document_attempts: attempts,
          next_action_due: null,
          last_action_at: nowIso,
          closed_at: nowIso,
          log: { track: "document", from: d, to: "documents_unavailable", note_code: "no_records_cap" },
          flag: "documents_unavailable",
        };
      }
      return {
        document_attempts: attempts,
        next_action_due: iso(now + 5 * DAY), // every 5 days
        last_action_at: nowIso,
        log: { track: "document", from: d, to: "documents_requested", note_code: "records_chased" },
      };
    }

    case "doc_received":
      return {
        document_state: "documents_received",
        next_action_due: iso(now + 1 * DAY), // upload promptly
        last_action_at: nowIso,
        log: { track: "document", from: d, to: "documents_received", note_code: "records_received" },
      };

    case "doc_uploaded":
      return {
        document_state: "documents_uploaded",
        next_action_due: iso(now + 1 * DAY),
        last_action_at: nowIso,
        log: { track: "document", from: d, to: "documents_uploaded", note_code: "records_uploaded" },
      };

    case "close":
      return {
        document_state: "closed",
        next_action_due: null,
        last_action_at: nowIso,
        closed_at: nowIso,
        log: { track: "document", from: d, to: "closed", note_code: "closed" },
      };
  }
}

// ---------------------------------------------------------------------------
// Urgency of a referral's next action, for To-Do sorting/coloring.
// ---------------------------------------------------------------------------
export type Urgency = "overdue" | "soon" | "scheduled" | "none";

export function urgency(r: Referral, now: Date = new Date()): Urgency {
  if (!r.next_action_due) return "none";
  const due = new Date(r.next_action_due).getTime();
  const t = now.getTime();
  if (t >= due) return "overdue";
  if (due - t <= 1 * DAY) return "soon";
  return "scheduled";
}

// What action is the operator expected to take next, in plain words.
export function nextActionLabel(r: Referral): string {
  const a = r.appointment_state;
  const d = r.document_state;

  if (a === "patient_not_replying") return "Review — unreachable patient";
  if (a === "referral_created" || a === "patient_contacted") return "Call patient to schedule";
  if (a === "appointment_scheduled") return "Pre-appointment confirmation call";
  if (a === "appointment_confirmed") return "Post-visit check";
  if (a === "appointment_rescheduled") return "Confirm new appointment";

  if (a === "appointment_completed") {
    if (d === "documents_requested") return "Chase specialist records";
    if (d === "documents_received") return "Upload records to eCW";
    if (d === "documents_uploaded") return "Close referral";
  }
  return "—";
}
