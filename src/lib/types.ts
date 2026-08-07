// ============================================================================
// Shared domain types — mirror the Supabase schema.
// PRIVACY: no patient-identifiable fields exist anywhere in this model.
// ============================================================================

export type AppointmentStatus =
  | "referral_created"
  | "patient_contacted"
  | "appointment_scheduled"
  | "appointment_confirmed"
  | "appointment_completed"
  | "appointment_rescheduled"
  | "patient_not_replying"
  | "patient_declined"
  | "cancelled";

export type DocumentStatus =
  | "awaiting_appointment"
  | "documents_requested"
  | "documents_received"
  | "documents_uploaded"
  | "documents_unavailable"
  | "closed";

export type UserRole = "admin" | "viewer";
export type ProviderScope = "all" | "own";
export type Track = "appointment" | "document";

export interface ReferringProvider {
  id: string;
  name: string; // "Last,First"
  active: boolean;
}

export interface Referral {
  id: string;
  code: string; // VOR-#######
  referring_provider_id: string;
  referring_provider_name?: string;
  specialist_name: string | null;
  specialist_phone: string | null;
  specialist_fax: string | null;
  specialty: string | null;
  appointment_state: AppointmentStatus;
  document_state: DocumentStatus;
  appointment_slot: string | null;
  contact_attempts: number;
  reschedule_count: number;
  document_attempts: number;
  next_action_due: string | null;
  last_action_at: string | null;
  referral_date: string;
  completed_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatusHistoryEntry {
  id: number;
  referral_id: string;
  track: Track;
  from_state: string | null;
  to_state: string;
  note_code: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface AppUser {
  id: string;
  full_name: string;
  role: UserRole;
  scope: ProviderScope;
  provider_id: string | null;
  active: boolean;
}

// ---- Human-readable labels (shipping-theme voice where it helps) ----------

export const APPT_LABEL: Record<AppointmentStatus, string> = {
  referral_created:        "Referral created",
  patient_contacted:       "Contacting patient",
  appointment_scheduled:   "Appointment scheduled",
  appointment_confirmed:   "Appointment confirmed",
  appointment_completed:   "Visit completed",
  appointment_rescheduled: "Rescheduled",
  patient_not_replying:    "Unable to reach patient",
  patient_declined:        "Patient declined",
  cancelled:               "Cancelled",
};

export const DOC_LABEL: Record<DocumentStatus, string> = {
  awaiting_appointment:    "Awaiting appointment",
  documents_requested:     "Records requested",
  documents_received:      "Records received",
  documents_uploaded:      "Records uploaded",
  documents_unavailable:   "Records unavailable",
  closed:                  "Delivered & filed",
};

// Status color intent for chips
export type Intent = "appt" | "docs" | "overdue" | "soon" | "done" | "muted";

export const APPT_INTENT: Record<AppointmentStatus, Intent> = {
  referral_created: "appt",
  patient_contacted: "appt",
  appointment_scheduled: "appt",
  appointment_confirmed: "appt",
  appointment_completed: "done",
  appointment_rescheduled: "soon",
  patient_not_replying: "overdue",
  patient_declined: "muted",
  cancelled: "muted",
};

export const DOC_INTENT: Record<DocumentStatus, Intent> = {
  awaiting_appointment: "muted",
  documents_requested: "docs",
  documents_received: "docs",
  documents_uploaded: "docs",
  documents_unavailable: "overdue",
  closed: "done",
};

// Terminal helpers
export const TERMINAL_APPT: AppointmentStatus[] = ["patient_declined", "cancelled"];
export const TERMINAL_DOC: DocumentStatus[] = ["documents_unavailable", "closed"];

export function isReferralClosed(r: Referral): boolean {
  return (
    r.document_state === "closed" ||
    TERMINAL_APPT.includes(r.appointment_state)
  );
}
