// ============================================================================
// Existing referral — a referral already in progress outside the app, entered
// at its real current stage. Pure rules shared by the form (live hints,
// suggested follow-up) and the server action (authoritative validation).
//
// No fake timeline: the only history row written is one "existing_baseline"
// marker recording the stage the referral entered the tracker at.
// ============================================================================

import type { AppointmentStatus, DocumentStatus } from "./types";
import { TERMINAL_APPT, TERMINAL_DOC } from "./types";
import { CAPS, suggestDue, type HistoryEvent, type TransitionFields } from "./statusEngine";

export const EXISTING_APPT_STATES: AppointmentStatus[] = [
  "referral_created",
  "patient_contacted",
  "awaiting_booking",
  "appointment_scheduled",
  "appointment_confirmed",
  "appointment_completed",
  "appointment_rescheduled",
  "patient_not_replying",
  "patient_declined",
  "cancelled",
];

const AFTER_VISIT_DOC_STATES: DocumentStatus[] = [
  "records_request_due",
  "documents_requested",
  "documents_received",
  "documents_uploaded",
  "documents_unavailable",
  "closed",
];

// Structured reasons for documents_unavailable (no free text).
export const UNAVAILABLE_REASONS = [
  "No response after repeated requests",
  "Specialist office closed or unreachable",
  "Specialist has no records for this visit",
  "Patient did not authorize release",
] as const;

export function docOptionsFor(a: AppointmentStatus): DocumentStatus[] {
  return a === "appointment_completed" ? AFTER_VISIT_DOC_STATES : ["awaiting_appointment"];
}

// Which stage-dependent inputs the form should show / require.
export function neededFields(a: AppointmentStatus, d: DocumentStatus) {
  const terminal = TERMINAL_APPT.includes(a) || TERMINAL_DOC.includes(d);
  return {
    slot: ["appointment_scheduled", "appointment_confirmed", "appointment_rescheduled", "appointment_completed"].includes(a),
    completedAt: a === "appointment_completed",
    closedAt: terminal,
    unavailableReason: d === "documents_unavailable",
    contactAttempts: ["referral_created", "patient_contacted", "awaiting_booking", "patient_not_replying"].includes(a),
    rescheduleCount: ["appointment_scheduled", "appointment_confirmed", "appointment_rescheduled", "appointment_completed"].includes(a),
    documentAttempts: d === "documents_requested" || d === "documents_unavailable",
    nextActionDue: !terminal && a !== "patient_not_replying",
  };
}

export interface ExistingReferralInput {
  mrn: string;
  referring_provider_id: string;
  referral_date: string; // ISO
  specialist_name: string;
  specialty: string;
  specialist_phone: string;
  specialist_fax: string;
  appointment_state: AppointmentStatus;
  document_state: DocumentStatus;
  contact_attempts: number;
  reschedule_count: number;
  document_attempts: number;
  appointment_slot: string | null; // ISO
  last_action_at: string | null; // ISO; defaults to the open date
  completed_at: string | null; // ISO
  closed_at: string | null; // ISO
  unavailable_reason: string | null;
  next_action_due: string | null; // ISO; null = use the suggestion
}

function t(isoStr: string): number {
  return new Date(isoStr).getTime();
}

function validInt(n: number, min: number, max: number): boolean {
  return Number.isInteger(n) && n >= min && n <= max;
}

// Returns the first problem, or null when the input is consistent.
export function validateExisting(i: ExistingReferralInput, now: Date = new Date()): string | null {
  const nowMs = now.getTime();
  const need = neededFields(i.appointment_state, i.document_state);

  if (!i.referring_provider_id) return "Pick the internal provider.";
  if (!i.referral_date || isNaN(t(i.referral_date))) return "Enter the original open date.";
  if (t(i.referral_date) > nowMs) return "Open date cannot be in the future.";
  const opened = t(i.referral_date);

  if (!EXISTING_APPT_STATES.includes(i.appointment_state)) return "Pick the current appointment status.";
  if (!docOptionsFor(i.appointment_state).includes(i.document_state)) {
    return i.appointment_state === "appointment_completed"
      ? "After a completed visit, pick where the records stand."
      : "Records status only applies after the visit is completed.";
  }

  if (need.slot) {
    if (!i.appointment_slot || isNaN(t(i.appointment_slot))) {
      return i.appointment_state === "appointment_completed"
        ? "Enter the visit date."
        : "This status needs the appointment date.";
    }
    if (t(i.appointment_slot) < opened) return "Appointment date cannot be before the open date.";
  }
  if (need.completedAt) {
    const c = i.completed_at ?? i.appointment_slot;
    if (!c || isNaN(t(c))) return "Enter the date the visit was completed.";
    if (t(c) > nowMs) return "A completed visit cannot be dated in the future.";
    if (t(c) < opened) return "Visit date cannot be before the open date.";
  }
  if (need.closedAt) {
    if (!i.closed_at || isNaN(t(i.closed_at))) return "Final statuses need the date they closed.";
    if (t(i.closed_at) > nowMs) return "Closed date cannot be in the future.";
    if (t(i.closed_at) < opened) return "Closed date cannot be before the open date.";
  }
  if (need.unavailableReason && !(UNAVAILABLE_REASONS as readonly string[]).includes(i.unavailable_reason ?? "")) {
    return "Pick why the records are unavailable.";
  }

  if (i.last_action_at) {
    if (isNaN(t(i.last_action_at))) return "Enter a valid last action date.";
    if (t(i.last_action_at) > nowMs) return "Last action date cannot be in the future.";
    if (t(i.last_action_at) < opened) return "Last action date cannot be before the open date.";
  }

  const scheduling = ["referral_created", "patient_contacted", "awaiting_booking"].includes(i.appointment_state);
  if (!validInt(i.contact_attempts, 0, scheduling ? CAPS.contact - 1 : 99)) {
    return scheduling
      ? `Contact attempts must be 0–${CAPS.contact - 1}. At ${CAPS.contact} the patient counts as not replying.`
      : "Contact attempts must be a whole number.";
  }
  if (!validInt(i.reschedule_count, 0, 99)) return "Reschedules must be a whole number.";
  const chasing = i.document_state === "documents_requested";
  if (!validInt(i.document_attempts, 0, chasing ? CAPS.document - 1 : 99)) {
    return chasing
      ? `Records follow-ups must be 0–${CAPS.document - 1}. At ${CAPS.document} records count as unavailable.`
      : "Records follow-ups must be a whole number.";
  }

  if (i.next_action_due && isNaN(t(i.next_action_due))) return "Enter a valid follow-up date.";
  return null;
}

export function suggestedDueForExisting(i: ExistingReferralInput, now: Date = new Date()): string | null {
  const base = new Date(i.last_action_at ?? i.referral_date);
  return suggestDue(i, base, now);
}

// Row + the single baseline history event. Call validateExisting first.
export function buildExisting(
  i: ExistingReferralInput,
  now: Date = new Date()
): { fields: TransitionFields & Record<string, unknown>; events: (HistoryEvent & { note_text?: string | null })[] } {
  const need = neededFields(i.appointment_state, i.document_state);
  const terminal = need.closedAt;
  const nextDue = !need.nextActionDue
    ? null
    : i.next_action_due ?? suggestedDueForExisting(i, now);

  return {
    fields: {
      mrn: i.mrn,
      referring_provider_id: i.referring_provider_id,
      specialist_name: i.specialist_name.trim() || null,
      specialty: i.specialty.trim() || null,
      specialist_phone: i.specialist_phone.trim() || null,
      specialist_fax: i.specialist_fax.trim() || null,
      referral_date: i.referral_date,
      appointment_state: i.appointment_state,
      document_state: i.document_state,
      appointment_slot: need.slot ? i.appointment_slot : null,
      contact_attempts: i.contact_attempts,
      reschedule_count: i.reschedule_count,
      document_attempts: i.document_attempts,
      last_action_at: i.last_action_at ?? i.referral_date,
      completed_at: need.completedAt ? i.completed_at ?? i.appointment_slot : null,
      closed_at: terminal ? i.closed_at : null,
      next_action_due: nextDue,
    },
    events: [
      {
        track: "meta",
        from: null,
        // "<appointment_state>/<document_state>" — the stage it entered the tracker at
        to: `${i.appointment_state}/${i.document_state}`,
        note_code: "existing_baseline",
        note_text: need.unavailableReason ? i.unavailable_reason : null,
      },
    ],
  };
}
