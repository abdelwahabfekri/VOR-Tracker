// Human-readable labels for the structured note_code values in status_history.
// These are NON-PHI reason codes — never free text.
export const NOTE_LABEL: Record<string, string> = {
  created: "Referral created",
  no_answer: "No answer — logged attempt",
  no_answer_cap: "No answer — max attempts reached, parked",
  booked: "Appointment booked",
  confirmed: "Attendance confirmed (pre-call)",
  precall_no_answer: "Pre-call: could not reach — held",
  visit_done: "Visit completed",
  no_show: "No-show — returned to scheduling",
  rescheduled: "Appointment rescheduled",
  declined: "Patient declined referral",
  cancelled: "Referral cancelled",
  reopened: "Re-engaged patient",
  records_chased: "Records chased",
  no_records_cap: "Records not received — max attempts, marked unavailable",
  records_received: "Records received",
  records_uploaded: "Records uploaded to eCW",
  closed: "Referral closed",
};

export function noteLabel(code: string | null): string {
  if (!code) return "Status change";
  return NOTE_LABEL[code] ?? code;
}
