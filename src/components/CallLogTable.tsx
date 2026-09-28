import type { StatusHistoryEntry } from "@/lib/types";
import { toCallLog } from "@/lib/callLog";
import { fmtDateTime } from "@/lib/tz";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";

export function CallLogTable({ entries }: { entries: StatusHistoryEntry[] }) {
  const rows = toCallLog(entries);
  if (rows.length === 0) {
    return <EmptyState icon="phone" title="No Calls Logged Yet" compact>Outgoing and incoming calls appear here as they are logged.</EmptyState>;
  }
  return (
    <div className="-mx-5 overflow-x-auto md:-mx-6">
      <table className="w-full min-w-[680px] text-sm">
        <caption className="sr-only">Call log, newest first</caption>
        <thead>
          <tr className="border-y border-line bg-table-head text-left">
            {["#", "Date & time", "Track", "Direction", "Purpose", "Outcome", "Notes"].map((h, i) => (
              <th key={h} scope="col" className={`whitespace-nowrap py-2.5 pr-3 text-2xs font-semibold uppercase tracking-[0.06em] text-muted ${i === 0 ? "pl-5 md:pl-6" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-line/60 last:border-0">
              <td className="num py-2.5 pl-5 pr-3 text-xs text-muted md:pl-6">{rows.length - i}</td>
              <td className="num whitespace-nowrap py-2.5 pr-3 text-xs text-ink">{fmtDateTime(r.at)}</td>
              <td className="py-2.5 pr-3">
                <span className={`rounded-md px-1.5 py-0.5 text-2xs font-semibold ${
                  r.track === "document" ? "bg-docs-soft text-docs" : "bg-appt-soft text-appt"
                }`}>
                  {r.track === "document" ? "Records" : "Appointment"}
                </span>
              </td>
              <td className="py-2.5 pr-3">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${r.direction === "inbound" ? "text-docs" : "text-navy"}`}>
                  <Icon name={r.direction === "inbound" ? "phoneIn" : "phoneOut"} className="h-3.5 w-3.5" />
                  {r.direction === "inbound" ? "Incoming" : "Outgoing"}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-ink">{r.purpose}</td>
              <td className="py-2.5 pr-3 text-muted">{r.outcome}</td>
              <td className="py-2.5 pr-5 text-muted md:pr-6">{r.note_text || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
