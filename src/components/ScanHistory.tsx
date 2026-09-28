import type { StatusHistoryEntry } from "@/lib/types";
import { APPT_LABEL, DOC_LABEL } from "@/lib/types";
import { noteLabel } from "@/lib/noteCodes";
import { fmtDateTime } from "@/lib/tz";

function stateLabel(track: string, s: string | null): string {
  if (!s) return "—";
  return (track === "document" ? DOC_LABEL : APPT_LABEL)[s as never] ?? s;
}

// Admin/system events carry extra context worth showing inline.
function detail(e: StatusHistoryEntry): string | null {
  switch (e.note_code) {
    case "status_corrected":
      return `${stateLabel(e.track, e.from_state)} → ${stateLabel(e.track, e.to_state)}`;
    case "followup_set":
      return `Next follow-up: ${fmtDateTime(e.to_state)}`;
    case "existing_baseline": {
      const [a, d] = e.to_state.split("/");
      return `Entered at: ${stateLabel("appointment", a)} · ${stateLabel("document", d)}`;
    }
    case "details_edited":
      return e.note_text; // lists field names only, never values
    default:
      return null;
  }
}

const TRACK_LABEL: Record<string, string> = { appointment: "appointment", document: "records", meta: "admin" };

// Shipping-style "scan history": newest event first, each timestamped.
export function ScanHistory({ entries }: { entries: StatusHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted">No events yet.</p>;
  }
  return (
    <ol className="relative space-y-4">
      {entries.map((e, i) => {
        const isLatest = i === 0;
        const track = e.track === "document" ? "docs" : "appt";
        return (
          <li key={e.id} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full ${
                  isLatest ? (track === "docs" ? "bg-docs ring-4 ring-docs/15" : "bg-appt ring-4 ring-appt/15") : "bg-line"
                }`}
              />
              {i < entries.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
            </div>
            <div className="pb-1">
              <div className={`text-sm font-medium ${isLatest ? "text-ink" : "text-ink/80"}`}>
                {noteLabel(e.note_code)}
              </div>
              {detail(e) && <div className="mt-0.5 text-xs text-ink/70">{detail(e)}</div>}
              <div className="mt-0.5 text-xs text-muted">
                {fmtDateTime(e.changed_at)}
                <span className="ml-2 uppercase tracking-wide text-[10px] text-muted/70">
                  {TRACK_LABEL[e.track] ?? e.track}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
