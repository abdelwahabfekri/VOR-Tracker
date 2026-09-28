// ============================================================================
// REFERRAL JOURNEY — pure model behind the journey tracker. No I/O.
//
// Ten milestones: five on the appointment track, five on the records track.
// A milestone is "current" while the referral sits in that stage, and "done"
// once the referral has moved past it. The last stop of each track (Visit
// completed, Filed & closed) completes the track, so it is never "current".
//
// Visit done unlocks the records track at "Records request needed" — it does
// NOT complete "Records requested"; that only happens when the office is
// actually asked.
// ============================================================================

import type { AppointmentStatus, DocumentStatus, Referral, StatusHistoryEntry } from "./types";
import type { IconName } from "@/components/Icon";
import { firstReachedMap } from "./callLog";

export type MilestoneTrack = "appt" | "docs";
export type MilestoneState =
  | "done"       // passed
  | "current"    // the referral is in this stage now
  | "upcoming"   // later on an active track
  | "locked"     // records track before the visit
  | "stopped"    // where an ended journey stopped (declined, cancelled, unavailable)
  | "skipped";   // after a stop — muted, not failed

export type MilestoneKey =
  | "created" | "contacting" | "scheduled" | "confirmed" | "visit"
  | "request_due" | "requested" | "received" | "uploaded" | "filed";

export interface MilestoneDef {
  key: MilestoneKey;
  label: string;
  track: MilestoneTrack;
  // states whose first-reached time dates this milestone
  states: string[];
}

export const MILESTONES: MilestoneDef[] = [
  { key: "created",     label: "Created",                track: "appt", states: ["referral_created"] },
  { key: "contacting",  label: "Contacting",             track: "appt", states: ["patient_contacted", "awaiting_booking"] },
  { key: "scheduled",   label: "Scheduled",              track: "appt", states: ["appointment_scheduled", "appointment_rescheduled"] },
  { key: "confirmed",   label: "Attendance confirmed",   track: "appt", states: ["appointment_confirmed"] },
  { key: "visit",       label: "Visit completed",        track: "appt", states: ["appointment_completed"] },
  { key: "request_due", label: "Records request needed", track: "docs", states: ["records_request_due"] },
  { key: "requested",   label: "Records requested",      track: "docs", states: ["documents_requested"] },
  { key: "received",    label: "Records received",       track: "docs", states: ["documents_received"] },
  { key: "uploaded",    label: "Uploaded to eCW",        track: "docs", states: ["documents_uploaded"] },
  { key: "filed",       label: "Filed & closed",         track: "docs", states: ["closed"] },
];

export const TOTAL_MILESTONES = MILESTONES.length; // 10
const APPT_COUNT = 5;

// Stage index (0..9) on the full route; 10 = everything done.
function apptStage(a: AppointmentStatus): number {
  switch (a) {
    case "referral_created": return 0;
    case "patient_contacted":
    case "awaiting_booking":
    case "patient_not_replying": return 1;
    case "appointment_scheduled":
    case "appointment_rescheduled": return 2;
    case "appointment_confirmed": return 3;
    case "appointment_completed": return APPT_COUNT; // track 1 complete
    default: return 1; // declined / cancelled resolved separately
  }
}

function docStage(d: DocumentStatus): number {
  switch (d) {
    case "records_request_due": return 5;
    case "documents_requested": return 6;
    case "documents_received": return 7;
    case "documents_uploaded": return 8;
    case "closed": return TOTAL_MILESTONES;
    default: return 6; // unavailable resolved separately
  }
}

export type JourneyPhase = "active" | "complete" | "ended" | "incomplete";

export interface Milestone extends MilestoneDef {
  index: number;
  state: MilestoneState;
  date: string | null;
}

export interface JourneyModel {
  milestones: Milestone[];
  completed: number;
  phase: JourneyPhase;
  currentTrack: "appointment" | "records" | null;
  recordsUnlocked: boolean;
  current: Milestone | null;
  // why an ended journey stopped
  endedLabel: string | null;
}

// The state a terminal event left from (e.g. declined while Scheduled).
function stoppedFrom(history: StatusHistoryEntry[], track: "appointment" | "document", terminal: string): string | null {
  const desc = [...history].sort((a, b) => b.changed_at.localeCompare(a.changed_at));
  const e = desc.find((h) => h.track === track && h.to_state === terminal);
  return e?.from_state ?? null;
}

export function buildJourney(r: Referral, history: StatusHistoryEntry[] = []): JourneyModel {
  const reached = firstReachedMap(history);
  const a = r.appointment_state;
  const d = r.document_state;

  let stage: number;         // index of the current stage (or TOTAL when done)
  let phase: JourneyPhase = "active";
  let endedLabel: string | null = null;

  if (a === "patient_declined" || a === "cancelled") {
    const from = stoppedFrom(history, "appointment", a) as AppointmentStatus | null;
    stage = from && from !== a ? Math.min(apptStage(from), APPT_COUNT - 1) : 1;
    phase = "ended";
    endedLabel = a === "cancelled" ? "Referral cancelled" : "Patient declined the referral";
  } else if (a !== "appointment_completed") {
    stage = apptStage(a);
  } else if (d === "documents_unavailable") {
    const from = stoppedFrom(history, "document", d) as DocumentStatus | null;
    stage = from && from !== d && from !== "awaiting_appointment" ? Math.min(docStage(from), TOTAL_MILESTONES - 1) : 6;
    phase = "incomplete";
    endedLabel = "Closed without records — incomplete";
  } else if (d === "awaiting_appointment") {
    stage = APPT_COUNT; // defensive: completed visit always unlocks records
  } else {
    stage = docStage(d);
  }
  if (stage >= TOTAL_MILESTONES) phase = "complete";

  const recordsUnlocked = a === "appointment_completed";
  const stopped = phase === "ended" || phase === "incomplete";

  const milestones: Milestone[] = MILESTONES.map((m, i) => {
    let state: MilestoneState;
    if (i < stage) state = "done";
    else if (i === stage) state = stopped ? "stopped" : "current";
    else if (stopped) state = "skipped";
    else if (m.track === "docs" && !recordsUnlocked) state = "locked";
    else state = "upcoming";

    let date: string | null = null;
    for (const s of m.states) if (reached[s]) { date = reached[s]; break; }
    if (m.key === "created") date = date ?? r.referral_date;
    // Visit completed shows the actual visit date, not when it was logged.
    if (m.key === "visit") date = r.appointment_slot ?? r.completed_at ?? date;
    return { ...m, index: i, state, date: state === "done" || state === "current" || state === "stopped" ? date : null };
  });

  const current = milestones.find((m) => m.state === "current") ?? null;
  return {
    milestones,
    completed: milestones.filter((m) => m.state === "done").length,
    phase,
    currentTrack: phase !== "active" ? null : recordsUnlocked ? "records" : "appointment",
    recordsUnlocked,
    current,
    endedLabel,
  };
}

// Icon for the current mission (next action) — shared by the mission card and To-Do.
export function missionIcon(r: Referral): IconName {
  const a = r.appointment_state;
  const d = r.document_state;
  if (a === "patient_not_replying") return "userX";
  if (a === "referral_created" || a === "patient_contacted") return "phoneOut";
  if (a === "awaiting_booking") return "calendar";
  if (a === "appointment_scheduled" || a === "appointment_rescheduled") return "phone";
  if (a === "appointment_confirmed") return "calendarCheck";
  if (d === "records_request_due") return "fileSearch";
  if (d === "documents_requested") return "mail";
  if (d === "documents_received") return "upload";
  if (d === "documents_uploaded") return "archive";
  return "route";
}
