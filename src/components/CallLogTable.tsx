import type { StatusHistoryEntry } from "@/lib/types";
import { toCallLog } from "@/lib/callLog";

export function CallLogTable({ entries }: { entries: StatusHistoryEntry[] }) {
  const rows = toCallLog(entries);
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No calls logged yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-3 font-semibold">#</th>
            <th className="py-2 pr-3 font-semibold">Date &amp; time</th>
            <th className="py-2 pr-3 font-semibold">Track</th>
            <th className="py-2 pr-3 font-semibold">Direction</th>
            <th className="py-2 pr-3 font-semibold">Purpose</th>
            <th className="py-2 font-semibold">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-line/60 last:border-0">
              <td className="py-2.5 pr-3 text-muted">{rows.length - i}</td>
              <td className="py-2.5 pr-3 text-ink">
                {new Date(r.at).toLocaleString(undefined, {
                  month: "short", day: "numeric", year: "numeric",
                  hour: "numeric", minute: "2-digit",
                })}
              </td>
              <td className="py-2.5 pr-3">
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                  r.track === "document" ? "bg-docs-soft text-docs" : "bg-appt-soft text-appt"
                }`}>
                  {r.track === "document" ? "Records" : "Appointment"}
                </span>
              </td>
              <td className="py-2.5 pr-3">
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                  r.direction === "inbound" ? "text-docs" : "text-navy"
                }`}>
                  {r.direction === "inbound" ? "↓ Incoming" : "↑ Outgoing"}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-ink">{r.purpose}</td>
              <td className="py-2.5 text-muted">{r.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
