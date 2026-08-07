"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Referral, ReferringProvider } from "@/lib/types";
import { ApptChip, DocChip, CodeChip, Card } from "@/components/ui";
import { ProviderFilter } from "@/components/ProviderFilter";
import { fmtDate } from "@/lib/tz";

export function TrackingTable({
  referrals,
  providers,
  activeProvider,
}: {
  referrals: Referral[];
  providers: ReferringProvider[];
  activeProvider?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return referrals;
    return referrals.filter(
      (r) =>
        r.code.toLowerCase().includes(needle) ||
        (r.specialist_name ?? "").toLowerCase().includes(needle) ||
        (r.referring_provider_name ?? "").toLowerCase().includes(needle)
    );
  }, [referrals, q]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ProviderFilter providers={providers} active={activeProvider} basePath="/tracking" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search code, specialist, provider…"
          className="w-72 max-w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-star focus:ring-2 focus:ring-star/20"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">Tracking code</th>
                <th className="px-4 py-3 font-semibold">Provider</th>
                <th className="px-4 py-3 font-semibold">Specialist</th>
                <th className="px-4 py-3 font-semibold">Opened</th>
                <th className="px-4 py-3 font-semibold">Last update</th>
                <th className="px-4 py-3 font-semibold">Appointment</th>
                <th className="px-4 py-3 font-semibold">Documents</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const dormant = r.document_state === "awaiting_appointment";
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/tracking/${r.code}`)}
                    className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-star/5"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <CodeChip code={r.code} />
                    </td>
                    <td className="px-4 py-3 text-ink">{r.referring_provider_name}</td>
                    <td className="px-4 py-3 text-muted">{r.specialist_name || "—"}</td>
                    <td className="px-4 py-3 text-muted">{fmtDate(r.referral_date)}</td>
                    <td className="px-4 py-3 text-muted">{fmtDate(r.last_action_at)}</td>
                    <td className="px-4 py-3"><ApptChip state={r.appointment_state} /></td>
                    <td className="px-4 py-3"><DocChip state={r.document_state} dormant={dormant} /></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    No referrals match. Adjust the filter or search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted">{rows.length} referral{rows.length === 1 ? "" : "s"}</p>
    </div>
  );
}
