import type { IconName } from "@/components/Icon";

// Human-readable labels for the structured note_code values in status_history.
// These are structured reason codes — never free text, never PHI.
export const NOTE_LABEL: Record<string, string> = {
  created: "Referral created",
  no_answer: "No answer — VM left",
  no_answer_cap: "No answer — max attempts reached, parked",
  awaiting_booking: "Patient will book — awaiting date",
  booked: "Appointment booked",
  confirmed: "Attendance confirmed (pre-call)",
  precall_no_answer: "Pre-call: no answer — VM left",
  visit_done: "Visit completed",
  no_show: "No-show — returned to scheduling",
  rescheduled: "Appointment rescheduled",
  declined: "Patient declined referral",
  cancelled: "Referral cancelled",
  reopened: "Re-engaged patient",
  records_request_due: "Records workflow unlocked — request needed",
  records_requested: "Records requested from specialist office",
  records_chased: "Records chased",
  no_records_cap: "Records not received — max attempts, marked unavailable",
  records_received: "Records received",
  records_uploaded: "Records uploaded to eCW",
  closed: "Referral filed & closed",
  // Admin / system events — not a normal step forward
  status_corrected: "Status corrected",
  followup_set: "Follow-up date set",
  details_edited: "Referral details edited",
  existing_baseline: "Added to tracker at current stage",
  migration_marker: "Records request needed (data migration)",
};

const NOTE_ICON: Record<string, IconName> = {
  created: "flag",
  no_answer: "phoneOut",
  no_answer_cap: "userX",
  awaiting_booking: "calendar",
  booked: "calendar",
  confirmed: "calendarCheck",
  precall_no_answer: "phoneOut",
  visit_done: "check",
  no_show: "userX",
  rescheduled: "calendar",
  declined: "ban",
  cancelled: "ban",
  reopened: "refresh",
  records_request_due: "unlock",
  records_requested: "mail",
  records_chased: "mail",
  no_records_cap: "alert",
  records_received: "fileIn",
  records_uploaded: "upload",
  closed: "archive",
  status_corrected: "edit",
  followup_set: "clock",
  details_edited: "edit",
  existing_baseline: "history",
  migration_marker: "sliders",
};

const ADMIN_CODES = new Set(["status_corrected", "followup_set", "details_edited", "existing_baseline", "migration_marker"]);

function base(code: string | null): string {
  return (code ?? "").replace(/^inbound_/, "");
}

export function noteLabel(code: string | null): string {
  if (!code) return "Status change";
  const inbound = code.startsWith("inbound_");
  const label = NOTE_LABEL[base(code)] ?? base(code);
  return inbound ? `Patient call — ${label}` : label;
}

export function noteIcon(code: string | null): IconName {
  if ((code ?? "").startsWith("inbound_")) return "phoneIn";
  return NOTE_ICON[base(code)] ?? "info";
}

// Admin/system events render in navy/slate, apart from the two tracks.
export function isAdminEvent(code: string | null): boolean {
  return ADMIN_CODES.has(base(code));
}
