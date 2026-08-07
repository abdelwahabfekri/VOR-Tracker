// ============================================================================
// Derive a structured "call log" view from status_history entries.
// No new database columns — everything is inferred from note_code + from_state.
// Direction is carried as an "inbound_" prefix on the note_code.
// ============================================================================

import type { StatusHistoryEntry, AppointmentStatus } from "./types";

export type CallDirection = "outbound" | "inbound" | "system";

export interface CallLogRow {
  id: number;
  at: string;
  track: "appointment" | "document";
  direction: CallDirection;
  purpose: string;   // why the contact happened
  outcome: string;   // what resulted
}

// note_codes that represent an actual phone contact (vs. a system/state event)
const CALL_CODES = new Set([
  "no_answer",
  "no_answer_cap",
  "awaiting_booking",
  "booked",
  "confirmed",
  "precall_no_answer",
  "visit_done",
  "no_show",
  "rescheduled",
  "declined",
  "records_chased",
  "no_records_cap",
  "records_received",
]);

function purposeFromState(fromState: string | null, track: string): string {
  if (track === "document") return "Records follow-up";
  switch (fromState as AppointmentStatus | null) {
    case "referral_created":
    case "patient_contacted":
    case "awaiting_booking":
      return "Scheduling call";
    case "appointment_scheduled":
    case "appointment_rescheduled":
      return "Appointment confirmation";
    case "appointment_confirmed":
      return "Post-visit check";
    case "patient_not_replying":
      return "Re-engagement";
    default:
      return "Follow-up";
  }
}

const OUTCOME: Record<string, string> = {
  no_answer: "No answer (VM left)",
  no_answer_cap: "No answer — max attempts, parked",
  awaiting_booking: "Reached patient — will book and call back",
  booked: "Appointment booked",
  confirmed: "Attendance confirmed",
  precall_no_answer: "No answer (VM left)",
  visit_done: "Visit confirmed complete",
  no_show: "No-show — back to scheduling",
  rescheduled: "Rescheduled to new date",
  declined: "Patient declined",
  records_chased: "No records yet — chased",
  no_records_cap: "Records not received — closed",
  records_received: "Records received",
};

export function toCallLog(entries: StatusHistoryEntry[]): CallLogRow[] {
  return entries
    .map((e) => {
      const raw = e.note_code ?? "";
      const inbound = raw.startsWith("inbound_");
      const base = inbound ? raw.slice("inbound_".length) : raw;
      if (!CALL_CODES.has(base)) return null;
      return {
        id: e.id,
        at: e.changed_at,
        track: e.track,
        direction: (inbound ? "inbound" : "outbound") as CallDirection,
        purpose: purposeFromState(e.from_state, e.track),
        outcome: OUTCOME[base] ?? base,
      } as CallLogRow;
    })
    .filter((x): x is CallLogRow => x !== null)
    .sort((a, b) => b.at.localeCompare(a.at)); // newest first
}

// First time each state was reached — for the checkpoint dates in the tracker.
export function firstReachedMap(entries: StatusHistoryEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  const asc = [...entries].sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  for (const e of asc) {
    if (!(e.to_state in map)) map[e.to_state] = e.changed_at;
  }
  return map;
}
