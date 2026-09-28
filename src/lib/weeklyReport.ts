// ============================================================================
// WEEKLY PROVIDER REPORT — pure functions, no I/O.
// Row selection, tags, change summary, ordering, and the plain-text / HTML
// email bodies. The app never sends mail; the admin copies this into Outlook.
// ============================================================================

import type { Referral, StatusHistoryEntry } from "./types";
import { APPT_LABEL, DOC_LABEL, isReferralClosed } from "./types";
import { isoToNyInput, nyInputToIso, fmtDate } from "./tz";

export type ActivityTag = "NEW THIS WEEK" | "UPDATED THIS WEEK" | "NO CHANGE THIS WEEK";
export type FollowupTag = "OVERDUE" | "DUE SOON" | "ON TRACK" | "PATIENT UNREACHABLE" | "CLOSED";

export interface ReportPeriod {
  startYmd: string; // first day, Eastern
  endYmd: string;   // last day, Eastern (inclusive)
  start: Date;      // 00:00 ET on startYmd
  end: Date;        // 00:00 ET the day after endYmd (exclusive)
}

export interface ReportRow {
  id: string;
  mrn: string;
  code: string;
  openDate: string;
  specialist: string;
  appointmentStatus: string;
  recordsStatus: string;
  lastChange: string;
  activity: ActivityTag;
  followup: FollowupTag;
  change: string;
}

const DAY = 24 * 3600 * 1000;

// ---- Period (Eastern calendar days) -----------------------------------------

export function todayYmd(now: Date = new Date()): string {
  return isoToNyInput(now.toISOString()).slice(0, 10);
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY).toISOString().slice(0, 10);
}

export function isYmd(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

// Default: the last seven days including today, Eastern Time.
export function makePeriod(startYmd?: string, endYmd?: string, now: Date = new Date()): ReportPeriod {
  const today = todayYmd(now);
  let end = isYmd(endYmd) ? endYmd : today;
  if (end > today) end = today; // statuses are current — a future end date means nothing
  let start = isYmd(startYmd) ? startYmd : addDaysYmd(end, -6);
  if (start > end) start = end;
  return {
    startYmd: start,
    endYmd: end,
    start: new Date(nyInputToIso(`${start}T00:00`)),
    end: new Date(nyInputToIso(`${addDaysYmd(end, 1)}T00:00`)),
  };
}

function inPeriod(iso: string | null, p: ReportPeriod): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= p.start.getTime() && t < p.end.getTime();
}

// ---- What counts as a real change -------------------------------------------

function baseCode(code: string | null): string {
  return (code ?? "").replace(/^inbound_/, "");
}

// Meaningful = a real transition on either track, a status correction, or a
// follow-up date change. Not meaningful: calls that left the status where it
// was, detail edits, the existing-referral baseline, migration markers.
export function isMeaningful(e: StatusHistoryEntry): boolean {
  const code = baseCode(e.note_code);
  if (code === "existing_baseline" || code === "migration_marker" || code === "details_edited") return false;
  if (code === "followup_set") return true;
  if (code === "status_corrected") return true;
  if (e.track === "meta") return false;
  return e.from_state !== e.to_state;
}

function stateLabel(track: string, state: string | null): string {
  if (!state) return "—";
  if (track === "appointment") return APPT_LABEL[state as keyof typeof APPT_LABEL] ?? state;
  return DOC_LABEL[state as keyof typeof DOC_LABEL] ?? state;
}

// ---- Tags ---------------------------------------------------------------------

export function activityTag(r: Referral, periodEvents: StatusHistoryEntry[], p: ReportPeriod): ActivityTag {
  if (inPeriod(r.referral_date, p)) return "NEW THIS WEEK";
  if (periodEvents.some(isMeaningful)) return "UPDATED THIS WEEK";
  return "NO CHANGE THIS WEEK";
}

export function followupTag(r: Referral, now: Date = new Date()): FollowupTag {
  if (isReferralClosed(r)) return "CLOSED";
  // Parked after the contact cap: no due date, but it is not "on track".
  if (r.appointment_state === "patient_not_replying") return "PATIENT UNREACHABLE";
  if (!r.next_action_due) return "ON TRACK";
  const due = new Date(r.next_action_due).getTime();
  if (due <= now.getTime()) return "OVERDUE";
  if (due - now.getTime() <= DAY) return "DUE SOON";
  return "ON TRACK";
}

// ---- Change summary -------------------------------------------------------------

export function changeSummary(r: Referral, periodEvents: StatusHistoryEntry[], p: ReportPeriod): string {
  const parts: string[] = [];
  if (inPeriod(r.referral_date, p)) parts.push("New referral opened");

  const meaningful = periodEvents.filter(isMeaningful).filter((e) => baseCode(e.note_code) !== "created");
  for (const track of ["appointment", "document"] as const) {
    const ev = meaningful.filter((e) => e.track === track);
    if (ev.length === 0) continue;
    const first = ev[0];
    const last = ev[ev.length - 1];
    const corrected = ev.some((e) => baseCode(e.note_code) === "status_corrected");
    const name = track === "appointment" ? "Appointment" : "Records";
    let text = `${name}: ${stateLabel(track, first.from_state)} → ${stateLabel(track, last.to_state)}`;
    if (ev.length > 1) text += ` (${ev.length} changes)`;
    if (corrected) text = `Status corrected — ${text}`;
    parts.push(text);
  }
  if (meaningful.some((e) => baseCode(e.note_code) === "followup_set")) parts.push("Follow-up date updated");

  return parts.length ? parts.join("; ") : "—";
}

// ---- Rows ---------------------------------------------------------------------------

// history: every status_history row for these referrals (any order).
export function buildReportRows(
  referrals: Referral[],
  history: StatusHistoryEntry[],
  p: ReportPeriod,
  now: Date = new Date()
): ReportRow[] {
  const byRef = new Map<string, StatusHistoryEntry[]>();
  for (const e of [...history].sort((a, b) => a.changed_at.localeCompare(b.changed_at))) {
    const list = byRef.get(e.referral_id) ?? [];
    list.push(e);
    byRef.set(e.referral_id, list);
  }

  return referrals
    .map((r) => {
      const all = byRef.get(r.id) ?? [];
      const periodEvents = all.filter((e) => inPeriod(e.changed_at, p));
      const closed = isReferralClosed(r);
      const include =
        !closed ||
        inPeriod(r.closed_at, p) ||
        inPeriod(r.referral_date, p) ||
        periodEvents.some(isMeaningful);
      if (!include) return null;

      const lastMeaningful = [...all].reverse().find(isMeaningful);
      const lastChange = lastMeaningful?.changed_at ?? r.last_action_at ?? r.referral_date;

      return {
        row: {
          id: r.id,
          mrn: r.mrn ?? "—",
          code: r.code,
          openDate: fmtDate(r.referral_date),
          specialist: r.specialist_name || "—",
          appointmentStatus: APPT_LABEL[r.appointment_state],
          recordsStatus: DOC_LABEL[r.document_state],
          lastChange: fmtDate(lastChange),
          activity: activityTag(r, periodEvents, p),
          followup: followupTag(r, now),
          change: changeSummary(r, periodEvents, p),
        } satisfies ReportRow,
        sortDate: new Date(r.referral_date).getTime(),
      };
    })
    .filter((x): x is { row: ReportRow; sortDate: number } => x !== null)
    // oldest open date first; VOR code breaks ties so the order is stable
    .sort((a, b) => a.sortDate - b.sortDate || a.row.code.localeCompare(b.row.code))
    .map((x) => x.row);
}

// ---- Email text ---------------------------------------------------------------------

// Provider names are stored "Last,First".
export function providerNames(stored: string): { full: string; last: string } {
  const [last, first] = stored.split(",").map((s) => s.trim());
  return { full: first ? `${first} ${last}` : last, last };
}

export function reportSubject(providerName: string, p: ReportPeriod): string {
  return `Weekly Referral Status Report — Dr. ${providerNames(providerName).full} — ${fmtYmd(p.endYmd)}`;
}

function fmtYmd(ymd: string): string {
  return fmtDate(nyInputToIso(`${ymd}T12:00`));
}

export function periodLabel(p: ReportPeriod): string {
  return `${fmtYmd(p.startYmd)} – ${fmtYmd(p.endYmd)} (Eastern Time)`;
}

const INTRO = (p: ReportPeriod) =>
  `Below is the current status of your vision referrals for ${periodLabel(p)}. ` +
  `It lists every active referral, plus any referral that changed or closed during this period.`;
const EMPTY = "There are no active referrals, and no referral changed or closed during this period.";
const LEGEND_ACTIVITY =
  "Weekly activity — NEW THIS WEEK: opened during the period. UPDATED THIS WEEK: status changed during the period. NO CHANGE THIS WEEK: no status change during the period.";
const LEGEND_FOLLOWUP =
  "Follow-up — OVERDUE: next follow-up is past due. DUE SOON: due within 24 hours. ON TRACK: next step is scheduled. " +
  "PATIENT UNREACHABLE: the patient could not be reached after the maximum number of attempts; review needed. " +
  "CLOSED: the referral reached a final status.";
const CLOSING = ["Please reply to this email with any questions.", "", "Thank you,", "Vision Department"];

export interface ReportOptions {
  showChange: boolean;
}

export function tablePlainText(rows: ReportRow[], opts: ReportOptions): string {
  if (rows.length === 0) return EMPTY;
  return rows
    .map((r, i) =>
      [
        `${i + 1}. MRN ${r.mrn} · ${r.code} · Opened ${r.openDate}`,
        `   Specialist: ${r.specialist}`,
        `   Appointment: ${r.appointmentStatus} · Records: ${r.recordsStatus}`,
        `   Last change: ${r.lastChange} · Weekly activity: ${r.activity} · Follow-up: ${r.followup}`,
        ...(opts.showChange ? [`   Weekly change: ${r.change}`] : []),
      ].join("\n")
    )
    .join("\n\n");
}

export function emailPlainText(providerName: string, p: ReportPeriod, rows: ReportRow[], opts: ReportOptions): string {
  return [
    `Dear Dr. ${providerNames(providerName).last},`,
    "",
    INTRO(p),
    "",
    tablePlainText(rows, opts),
    "",
    ...(rows.length ? [LEGEND_ACTIVITY, LEGEND_FOLLOWUP, ""] : []),
    ...CLOSING,
  ].join("\n");
}

// ---- HTML (Outlook-safe: tables + inline styles only) -----------------------

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TAG_STYLE: Record<ActivityTag | FollowupTag, string> = {
  "NEW THIS WEEK": "background:#E8F1F8;color:#24507A;",
  "UPDATED THIS WEEK": "background:#E4EFEA;color:#2E7D5B;",
  "NO CHANGE THIS WEEK": "background:#EEF1F5;color:#4A5563;",
  OVERDUE: "background:#FBEAE8;color:#C0392B;",
  "PATIENT UNREACHABLE": "background:#FBEAE8;color:#C0392B;", // same as overdue: needs attention
  "DUE SOON": "background:#FBF1E1;color:#8A5A0B;",
  "ON TRACK": "background:#E4EFEA;color:#2E7D5B;",
  CLOSED: "background:#EEF1F5;color:#4A5563;",
};

function tag(t: ActivityTag | FollowupTag): string {
  return `<span style="${TAG_STYLE[t]}font-weight:bold;font-size:11px;padding:2px 6px;white-space:nowrap;">${esc(t)}</span>`;
}

const FONT = "font-family:Calibri,Arial,sans-serif;font-size:13px;color:#182531;";
const TH = "border:1px solid #C9D2DC;background:#0F2A4A;color:#FFFFFF;padding:6px 8px;text-align:left;font-weight:bold;";
const TD = "border:1px solid #C9D2DC;padding:6px 8px;vertical-align:top;";

export function tableHtml(rows: ReportRow[], opts: ReportOptions): string {
  if (rows.length === 0) return `<p style="${FONT}">${esc(EMPTY)}</p>`;
  const heads = [
    "MRN", "VOR Code", "Open Date", "Specialist", "Appointment Status", "Records Status",
    "Last Change", "Weekly Activity", "Follow-up", ...(opts.showChange ? ["Weekly Change"] : []),
  ];
  const body = rows
    .map((r) => {
      const cells = [
        esc(r.mrn), esc(r.code), esc(r.openDate), esc(r.specialist), esc(r.appointmentStatus),
        esc(r.recordsStatus), esc(r.lastChange), tag(r.activity), tag(r.followup),
        ...(opts.showChange ? [esc(r.change)] : []),
      ];
      return `<tr>${cells.map((c) => `<td style="${TD}">${c}</td>`).join("")}</tr>`;
    })
    .join("");
  return (
    `<table cellpadding="0" cellspacing="0" border="1" style="border-collapse:collapse;${FONT}">` +
    `<thead><tr>${heads.map((h) => `<th style="${TH}">${esc(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${body}</tbody></table>`
  );
}

export function emailHtml(providerName: string, p: ReportPeriod, rows: ReportRow[], opts: ReportOptions): string {
  const para = (t: string) => `<p style="${FONT}margin:0 0 12px 0;">${esc(t)}</p>`;
  return [
    `<div style="${FONT}">`,
    para(`Dear Dr. ${providerNames(providerName).last},`),
    para(INTRO(p)),
    tableHtml(rows, opts),
    rows.length ? `<p style="${FONT}font-size:12px;color:#4A5563;margin:12px 0 4px 0;">${esc(LEGEND_ACTIVITY)}</p>` : "",
    rows.length ? `<p style="${FONT}font-size:12px;color:#4A5563;margin:0 0 12px 0;">${esc(LEGEND_FOLLOWUP)}</p>` : "",
    para(CLOSING[0]),
    `<p style="${FONT}margin:0;">${esc(CLOSING[2])}<br>${esc(CLOSING[3])}</p>`,
    `</div>`,
  ].join("");
}
