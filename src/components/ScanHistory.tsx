import type { StatusHistoryEntry } from "@/lib/types";
import { noteLabel } from "@/lib/noteCodes";
import { fmtDateTime } from "@/lib/tz";

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
              <div className="mt-0.5 text-xs text-muted">
                {fmtDateTime(e.changed_at)}
                <span className="ml-2 uppercase tracking-wide text-[10px] text-muted/70">
                  {e.track === "document" ? "records" : "appointment"}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
