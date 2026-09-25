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
//   Visit done:           records request needed — contact specialist office now
//   Records requested:    separate action once the office is actually asked
//   Documents chase:      every 5 days, max 3 attempts -> documents_unavailable
// ============================================================================

import type {
  Referral,
  AppointmentStatus,
  DocumentStatus,
  HistoryTrack,
} from "./types";
import { APPT_LABEL, DOC_LABEL, TERMINAL_APPT, TERMINAL_DOC, isReferralClosed } from "./types";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export const CAPS = { contact: 5, reschedule: 3, document: 3 } as const;

// ---- Actions the admin can take ----------------------------------------
export type Action =
  // Track 1
  | { kind: "log_no_answer" }          // failed contact attempt (scheduling phase)
  | { kind: "awaiting_booking" }       // reached patient — they'll book and call back
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
  | { kind: "records_requested" }      // specialist office actually asked for records
  | { kind: "doc_chase_no_response" }  // failed records chase
  | { kind: "doc_received" }
  | { kind: "doc_uploaded" }
  | { kind: "close" }
  // Either track
  | { kind: "set_followup"; due: string }  // move next_action_due only; no status change

export type ActionKind = Action["kind"];

// One status_history row. A single action can write several (one per track changed).
export interface HistoryEvent {
  track: HistoryTrack;
  from: string | null;
  to: string;
  note_code: string;
}

export interface TransitionFields {
  appointment_state?: AppointmentStatus;
  document_state?: DocumentStatus;
  appointment_slot?: string | null;
  contact_attempts?: number;
  reschedule_count?: number;
  document_attempts?: number;
  next_action_due?: string | null;
  last_action_at?: string;
  completed_at?: string | null;
  closed_at?: string | null;
}

export interface TransitionResult {
  fields: TransitionFields;
  events: HistoryEvent[];
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
// Which states each action may start from. Enforced on the server before any
// write — hiding buttons in the UI is not enough.
// ---------------------------------------------------------------------------
const SCHEDULING: AppointmentStatus[] = ["referral_created", "patient_contacted", "awaiting_booking"];
const BOOKED: AppointmentStatus[] = ["appointment_scheduled", "appointment_rescheduled", "appointment_confirmed"];

const ALLOWED_FROM: Record<Exclude<ActionKind, "set_followup">, { appt?: AppointmentStatus[]; doc?: DocumentStatus[] }> = {
  log_no_answer:          { appt: SCHEDULING },
  awaiting_booking:       { appt: SCHEDULING },
  book_appointment:       { appt: SCHEDULING },
  confirm_attendance:     { appt: ["appointment_scheduled", "appointment_rescheduled"] },
  precall_no_answer:      { appt: ["appointment_scheduled", "appointment_rescheduled"] },
  mark_completed:         { appt: BOOKED },
  mark_no_show:           { appt: BOOKED },
  reschedule:             { appt: BOOKED },
  patient_declined:       { appt: [...SCHEDULING, ...BOOKED, "patient_not_replying"] },
  cancel:                 { appt: [...SCHEDULING, ...BOOKED, "patient_not_replying"] },
  reopen_contact:         { appt: ["patient_not_replying"] },
  records_requested:      { appt: ["appointment_completed"], doc: ["records_request_due"] },
  doc_chase_no_response:  { appt: ["appointment_completed"], doc: ["documents_requested"] },
  doc_received:           { appt: ["appointment_completed"], doc: ["documents_requested"] },
  doc_uploaded:           { appt: ["appointment_completed"], doc: ["documents_received"] },
  close:                  { appt: ["appointment_completed"], doc: ["documents_uploaded"] },
};

// Throws a user-readable error if the action does not fit the current state.
export function assertAllowed(r: Referral, action: Action): void {
  if (isReferralClosed(r)) {
    throw new Error("This referral is closed. Use Correct status to reopen it.");
  }
  if (action.kind === "set_followup") return;
  const rule = ALLOWED_FROM[action.kind];
  if (rule.appt && !rule.appt.includes(r.appointment_state)) {
    throw new Error(`Not allowed while the appointment is “${APPT_LABEL[r.appointment_state]}”.`);
  }
  if (rule.doc && !rule.doc.includes(r.document_state)) {
    throw new Error(`Not allowed while records are “${DOC_LABEL[r.document_state]}”.`);
  }
  if (action.kind === "confirm_attendance" && !(action.slot ?? r.appointment_slot)) {
    throw new Error("Confirming needs an appointment date.");
  }
  if ((action.kind === "book_appointment" || action.kind === "reschedule") && isNaN(Date.parse(action.slot))) {
    throw new Error("Pick a valid appointment date.");
  }
}

// ---------------------------------------------------------------------------
// Apply an action to a referral, returning the field changes + history rows.
// Throws on actions that don't make sense for the current state.
// ---------------------------------------------------------------------------
export function applyAction(r: Referral, action: Action, nowDate: Date = new Date()): TransitionResult {
  assertAllowed(r, action);

  const now = nowDate.getTime();
  const nowIso = iso(now);
  const a = r.appointment_state;
  const d = r.document_state;
  const appt = (to: AppointmentStatus, note_code: string): HistoryEvent => ({ track: "appointment", from: a, to, note_code });
  const doc = (to: DocumentStatus, note_code: string): HistoryEvent => ({ track: "document", from: d, to, note_code });

  switch (action.kind) {
    // ---------------- Track 1: scheduling phase ----------------
    case "log_no_answer": {
      const attempts = r.contact_attempts + 1;
      if (attempts >= CAPS.contact) {
        return {
          fields: {
            appointment_state: "patient_not_replying",
            contact_attempts: attempts,
            next_action_due: null,
            last_action_at: nowIso,
          },
          events: [appt("patient_not_replying", "no_answer_cap")],
          flag: "parked_not_replying",
        };
      }
      const to: AppointmentStatus = a === "referral_created" ? "patient_contacted" : a;
      return {
        fields: {
          appointment_state: to,
          contact_attempts: attempts,
          next_action_due: iso(now + 3 * DAY), // every 3 days
          last_action_at: nowIso,
        },
        events: [appt(to, "no_answer")],
      };
    }

    case "awaiting_booking":
      // Patient answered and will book — a real contact, so it does NOT
      // count against the no-answer cap (contact_attempts unchanged).
      return {
        fields: { appointment_state: "awaiting_booking", next_action_due: iso(now + 3 * DAY), last_action_at: nowIso },
        events: [appt("awaiting_booking", "awaiting_booking")],
      };

    case "book_appointment": {
      const slotMs = new Date(action.slot).getTime();
      return {
        fields: {
          appointment_state: "appointment_scheduled",
          appointment_slot: action.slot,
          // pre-appointment confirmation call due 24h before the slot
          next_action_due: iso(slotMs - 24 * HOUR),
          last_action_at: nowIso,
        },
        events: [appt("appointment_scheduled", "booked")],
      };
    }

    // ---------------- Track 1: confirmation + visit ----------------
    case "confirm_attendance": {
      // If the user entered a corrected date at confirmation time, use and persist it;
      // otherwise fall back to the slot already booked.
      const confirmedSlot = (action.slot ?? r.appointment_slot) as string;
      return {
        fields: {
          appointment_state: "appointment_confirmed",
          appointment_slot: confirmedSlot,               // lock in the confirmed date
          // post-appointment completion check due 24h after the confirmed slot
          next_action_due: iso(new Date(confirmedSlot).getTime() + 24 * HOUR),
          last_action_at: nowIso,
        },
        events: [appt("appointment_confirmed", "confirmed")],
      };
    }

    case "precall_no_answer": {
      // Status held; resolve at post-appointment call. Keep due at +24h after slot.
      const slotMs = r.appointment_slot ? new Date(r.appointment_slot).getTime() : now;
      return {
        fields: { next_action_due: iso(slotMs + 24 * HOUR), last_action_at: nowIso },
        events: [appt(a, "precall_no_answer")],
      };
    }

    case "mark_completed":
      // Track 1 ends. Track 2 activates at "records request needed" — the visit
      // happening does NOT mean records were requested; that is its own action.
      return {
        fields: {
          appointment_state: "appointment_completed",
          document_state: "records_request_due",
          completed_at: nowIso,
          next_action_due: nowIso, // contact the specialist office now
          last_action_at: nowIso,
        },
        events: [appt("appointment_completed", "visit_done"), doc("records_request_due", "records_request_due")],
      };

    case "mark_no_show":
      // Silent revert to the not-scheduled cycle (no distinct status).
      return {
        fields: {
          appointment_state: "patient_contacted",
          appointment_slot: null,
          next_action_due: iso(now + 3 * DAY),
          last_action_at: nowIso,
        },
        events: [appt("patient_contacted", "no_show")],
      };

    case "reschedule": {
      const count = r.reschedule_count + 1;
      const slotMs = new Date(action.slot).getTime();
      return {
        fields: {
          appointment_state: "appointment_rescheduled",
          appointment_slot: action.slot,
          reschedule_count: count,
          next_action_due: iso(slotMs - 24 * HOUR), // pre-call for the new slot
          last_action_at: nowIso,
        },
        events: [appt("appointment_rescheduled", "rescheduled")],
        flag: count >= CAPS.reschedule ? "reschedule_cap_review" : undefined,
      };
    }

    case "patient_declined":
      return {
        fields: { appointment_state: "patient_declined", next_action_due: null, last_action_at: nowIso, closed_at: nowIso },
        events: [appt("patient_declined", "declined")],
      };

    case "cancel":
      return {
        fields: { appointment_state: "cancelled", next_action_due: null, last_action_at: nowIso, closed_at: nowIso },
        events: [appt("cancelled", "cancelled")],
      };

    case "reopen_contact":
      return {
        fields: { appointment_state: "patient_contacted", contact_attempts: 0, next_action_due: iso(now + 3 * DAY), last_action_at: nowIso },
        events: [appt("patient_contacted", "reopened")],
      };

    // ---------------- Track 2: documents ----------------
    case "records_requested":
      return {
        fields: { document_state: "documents_requested", next_action_due: iso(now + 5 * DAY), last_action_at: nowIso },
        events: [doc("documents_requested", "records_requested")],
      };

    case "doc_chase_no_response": {
      const attempts = r.document_attempts + 1;
      if (attempts >= CAPS.document) {
        return {
          fields: {
            document_state: "documents_unavailable",
            document_attempts: attempts,
            next_action_due: null,
            last_action_at: nowIso,
            closed_at: nowIso,
          },
          events: [doc("documents_unavailable", "no_records_cap")],
          flag: "documents_unavailable",
        };
      }
      return {
        fields: { document_attempts: attempts, next_action_due: iso(now + 5 * DAY), last_action_at: nowIso },
        events: [doc("documents_requested", "records_chased")],
      };
    }

    case "doc_received":
      return {
        fields: { document_state: "documents_received", next_action_due: iso(now + 1 * DAY), last_action_at: nowIso },
        events: [doc("documents_received", "records_received")],
      };

    case "doc_uploaded":
      return {
        fields: { document_state: "documents_uploaded", next_action_due: iso(now + 1 * DAY), last_action_at: nowIso },
        events: [doc("documents_uploaded", "records_uploaded")],
      };

    case "close":
      return {
        fields: { document_state: "closed", next_action_due: null, last_action_at: nowIso, closed_at: nowIso },
        events: [doc("closed", "closed")],
      };

    // ---------------- Either track ----------------
    case "set_followup": {
      if (isNaN(Date.parse(action.due))) throw new Error("Pick a valid follow-up date.");
      // Moves the clock only. last_action_at is left alone on purpose: pushing a
      // date out is not activity, so it must not clear a "no update" tag.
      return {
        fields: { next_action_due: new Date(action.due).toISOString() },
        events: [{ track: "meta", from: r.next_action_due, to: new Date(action.due).toISOString(), note_code: "followup_set" }],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Suggested next_action_due for a referral sitting in a given state — used when
// a referral enters the tracker mid-flight and after a status correction.
//   base: the last known action time the clock runs from.
// ---------------------------------------------------------------------------
export function suggestDue(
  s: {
    appointment_state: AppointmentStatus;
    document_state: DocumentStatus;
    appointment_slot: string | null;
    referral_date: string;
  },
  base: Date,
  now: Date = new Date()
): string | null {
  const a = s.appointment_state;
  const d = s.document_state;
  const b = base.getTime();
  const slot = s.appointment_slot ? new Date(s.appointment_slot).getTime() : null;

  if (TERMINAL_APPT.includes(a) || TERMINAL_DOC.includes(d)) return null;
  if (a === "patient_not_replying") return null; // parked — reviewed, not chased
  if (a === "referral_created") return iso(new Date(s.referral_date).getTime() + 24 * HOUR);
  if (a === "patient_contacted" || a === "awaiting_booking") return iso(b + 3 * DAY);
  if (a === "appointment_scheduled" || a === "appointment_rescheduled") return slot !== null ? iso(slot - 24 * HOUR) : iso(now.getTime());
  if (a === "appointment_confirmed") return slot !== null ? iso(slot + 24 * HOUR) : iso(now.getTime());
  // appointment_completed
  if (d === "records_request_due") return iso(now.getTime());
  if (d === "documents_requested") return iso(b + 5 * DAY);
  if (d === "documents_received" || d === "documents_uploaded") return iso(b + 1 * DAY);
  return null;
}

// ---------------------------------------------------------------------------
// Correct status — admin-only escape hatch to fix a wrong entry. Bypasses the
// normal sequence, but never rewrites history: it appends "status_corrected"
// rows (one per track that changes) and recomputes the dependent fields.
// ---------------------------------------------------------------------------
export type Correction =
  | { track: "appointment"; to: AppointmentStatus; slot?: string | null; completedAt?: string | null }
  | { track: "document"; to: DocumentStatus };

export function correctStatus(r: Referral, c: Correction, nowDate: Date = new Date()): TransitionResult {
  const nowIso = nowDate.toISOString();
  let a = r.appointment_state;
  let d = r.document_state;
  let slot = r.appointment_slot;
  let completedAt = r.completed_at;
  const events: HistoryEvent[] = [];

  if (c.track === "appointment") {
    if (c.to === a) throw new Error("That is already the current appointment status.");
    const needsSlot = BOOKED.includes(c.to) || c.to === "appointment_completed";
    if (c.slot !== undefined) slot = c.slot;
    if (needsSlot && !slot) throw new Error("This status needs an appointment date.");
    if (SCHEDULING.includes(c.to) || c.to === "patient_not_replying") slot = null;

    events.push({ track: "appointment", from: a, to: c.to, note_code: "status_corrected" });
    a = c.to;

    if (a === "appointment_completed") {
      completedAt = c.completedAt ?? completedAt ?? slot ?? nowIso;
      if (d === "awaiting_appointment") {
        events.push({ track: "document", from: d, to: "records_request_due", note_code: "status_corrected" });
        d = "records_request_due";
      }
    } else {
      completedAt = null;
      // Records can only be in play after a completed visit.
      if (d !== "awaiting_appointment") {
        events.push({ track: "document", from: d, to: "awaiting_appointment", note_code: "status_corrected" });
        d = "awaiting_appointment";
      }
    }
  } else {
    if (c.to === d) throw new Error("That is already the current records status.");
    if (a !== "appointment_completed") {
      throw new Error("Records status can only change after the visit is completed. Correct the appointment first.");
    }
    if (c.to === "awaiting_appointment") {
      throw new Error("To undo the visit, correct the appointment status instead.");
    }
    events.push({ track: "document", from: d, to: c.to, note_code: "status_corrected" });
    d = c.to;
  }

  const terminal = TERMINAL_APPT.includes(a) || TERMINAL_DOC.includes(d);
  const next = { appointment_state: a, document_state: d, appointment_slot: slot, referral_date: r.referral_date };
  return {
    fields: {
      appointment_state: a,
      document_state: d,
      appointment_slot: slot,
      completed_at: completedAt,
      closed_at: terminal ? r.closed_at ?? nowIso : null,
      next_action_due: suggestDue(next, nowDate, nowDate),
    },
    events,
  };
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
  if (a === "awaiting_booking") return "Follow up — patient will book";
  if (a === "appointment_scheduled") return "Pre-appointment confirmation call";
  if (a === "appointment_confirmed") return "Post-visit check";
  if (a === "appointment_rescheduled") return "Confirm new appointment";

  if (a === "appointment_completed") {
    if (d === "records_request_due") return "Contact specialist office to request records";
    if (d === "documents_requested") return "Chase specialist records";
    if (d === "documents_received") return "Upload records to eCW";
    if (d === "documents_uploaded") return "Close referral";
  }
  return "—";
}

// ---------------------------------------------------------------------------
// Stale referral: no real action for a while. Independent of Overdue — a
// referral waiting on an appointment two weeks out is stale but not late.
// ---------------------------------------------------------------------------
export type StaleTag = "NO UPDATE 7+ DAYS" | "NO UPDATE 14+ DAYS";

export function staleTag(r: Referral, now: Date = new Date()): StaleTag | null {
  if (isReferralClosed(r)) return null;
  const last = new Date(r.last_action_at ?? r.referral_date).getTime();
  const days = (now.getTime() - last) / DAY;
  if (days >= 14) return "NO UPDATE 14+ DAYS";
  if (days >= 7) return "NO UPDATE 7+ DAYS";
  return null;
}
