"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Referral, ReferringProvider } from "@/lib/types";
import { isActive, closedKind, CLOSED_KIND_LABEL, CLOSED_KIND_INTENT } from "@/lib/types";
import { ApptChip, DocChip, CodeChip, Card, IntentChip, StaleChip, FollowupTag, Mrn, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { staleTag, followupKind } from "@/lib/statusEngine";
import { ProviderFilter } from "@/components/ProviderFilter";
import { fmtDate } from "@/lib/tz";

type StatusTab = "active" | "closed";

// Trim + collapse spaces; compare as text so leading zeros count.
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export function TrackingTable({
  referrals,
  providers,
  activeProvider,
  activeStatus = "active",
}: {
  referrals: Referral[];
  providers: ReferringProvider[];
  activeProvider?: string;
  activeStatus?: StatusTab;
}) {
  const router = useRouter();
  // MRN filter lives only in component state — never in the URL.
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const active = referrals.filter(isActive).length;
    return { active, closed: referrals.length - active };
  }, [referrals]);

  const byStatus = useMemo(
    () => referrals.filter((r) => (activeStatus === "closed" ? closedKind(r) !== null : isActive(r))),
    [referrals, activeStatus]
  );

  const rows = useMemo(() => {
    const needle = norm(q);
    if (!needle) return byStatus;
    return byStatus
      .filter((r) => norm(r.mrn ?? "").includes(needle))
      // exact MRN matches first, then prefix matches, then the rest
      .map((r) => {
        const m = norm(r.mrn ?? "");
        return { r, rank: m === needle ? 0 : m.startsWith(needle) ? 1 : 2 };
      })
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.r);
  }, [byStatus, q]);

  const tabHref = (status: StatusTab) =>
    `/tracking?status=${status}${activeProvider ? `&provider=${activeProvider}` : ""}`;
  const closedTab = activeStatus === "closed";

  return (
    <div>
      {/* Filter bar */}
      <Card className="mb-5 flex flex-wrap items-center gap-3 p-2.5 sm:gap-4">
        <div role="tablist" aria-label="Referral status" className="flex rounded-ctl bg-canvas p-1 ring-1 ring-inset ring-line">
          <TabLink href={tabHref("active")} active={!closedTab} count={counts.active}>Active</TabLink>
          <TabLink href={tabHref("closed")} active={closedTab} count={counts.closed}>Closed</TabLink>
        </div>
        <ProviderFilter providers={providers} active={activeProvider} basePath="/tracking" />
        <div className="relative ml-auto w-full sm:w-72">
          <label htmlFor="mrn-filter" className="sr-only">Filter by MRN</label>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="mrn-filter"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by MRN…"
            autoComplete="off"
            spellCheck={false}
            className="field pl-9"
          />
        </div>
      </Card>

      {/* Desktop / tablet: table */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="sr-only">{closedTab ? "Closed" : "Active"} referrals</caption>
            <thead>
              <tr className="border-b border-line bg-table-head text-left">
                <Th>MRN</Th>
                <Th>Tracking code</Th>
                <Th>Provider</Th>
                <Th>Specialist</Th>
                <Th>Opened</Th>
                {closedTab ? (
                  <>
                    <Th>Closed</Th>
                    <Th>Closed as</Th>
                  </>
                ) : (
                  <Th>Follow-up</Th>
                )}
                <Th>Status</Th>
                <th className="w-8" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const kind = closedKind(r);
                const f = followupKind(r);
                const open = () => router.push(`/tracking/${r.code}`);
                return (
                  <tr
                    key={r.id}
                    onClick={open}
                    onKeyDown={(e) => { if (e.key === "Enter") open(); }}
                    tabIndex={0}
                    aria-label={`Open referral ${r.code}`}
                    className="group cursor-pointer border-b border-line/70 transition duration-fast last:border-0 hover:bg-row-hover focus-visible:bg-row-hover focus-visible:outline-none"
                  >
                    <td className="px-4 py-3"><Mrn value={r.mrn} className="text-[13px]" /></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-start gap-1">
                        <CodeChip code={r.code} />
                        <StaleChip tag={staleTag(r)} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink">{r.referring_provider_name}</td>
                    <td className="px-4 py-3 text-muted">{r.specialist_name || "—"}</td>
                    <td className="num whitespace-nowrap px-4 py-3 text-xs text-muted">{fmtDate(r.referral_date)}</td>
                    {closedTab ? (
                      <>
                        <td className="num whitespace-nowrap px-4 py-3 text-xs text-muted">{fmtDate(r.closed_at)}</td>
                        <td className="px-4 py-3">
                          {kind && <IntentChip intent={CLOSED_KIND_INTENT[kind]}>{CLOSED_KIND_LABEL[kind]}</IntentChip>}
                        </td>
                      </>
                    ) : (
                      <td className="px-4 py-3">
                        {f && f !== "ontrack" ? <FollowupTag kind={f} /> : <span className="text-xs text-muted">On track</span>}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <ApptChip state={r.appointment_state} />
                        <DocChip state={r.document_state} />
                      </div>
                    </td>
                    <td className="pr-3 text-star"><Icon name="chevronRight" className="row-arrow h-4 w-4" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <NoRows filtered={!!q.trim()} closed={closedTab} />}
      </Card>

      {/* Phone: cards, MRN and status first */}
      <div className="space-y-3 md:hidden">
        {rows.map((r) => {
          const f = followupKind(r);
          const kind = closedKind(r);
          return (
            <Link key={r.id} href={`/tracking/${r.code}`} className="block">
              <Card interactive className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">MRN</div>
                    <Mrn value={r.mrn} />
                  </div>
                  <span className="num text-xs font-semibold text-navy">{r.code}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <ApptChip state={r.appointment_state} />
                  <DocChip state={r.document_state} />
                  {kind && <IntentChip intent={CLOSED_KIND_INTENT[kind]}>{CLOSED_KIND_LABEL[kind]}</IntentChip>}
                  {f && f !== "ontrack" && <FollowupTag kind={f} />}
                  <StaleChip tag={staleTag(r)} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span className="truncate">{r.referring_provider_name} · {r.specialist_name || "—"}</span>
                  <span className="num shrink-0">{fmtDate(r.referral_date)}</span>
                </div>
              </Card>
            </Link>
          );
        })}
        {rows.length === 0 && <Card><NoRows filtered={!!q.trim()} closed={closedTab} /></Card>}
      </div>

      <p className="mt-3 text-xs text-muted" aria-live="polite">
        {rows.length} referral{rows.length === 1 ? "" : "s"}
        {q.trim() ? " match this MRN" : ""}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="whitespace-nowrap px-4 py-3 text-2xs font-semibold uppercase tracking-[0.06em] text-muted">{children}</th>;
}

function NoRows({ filtered, closed }: { filtered: boolean; closed: boolean }) {
  if (filtered) {
    return (
      <EmptyState icon="search" title="No referrals match this MRN" compact>
        Check the digits (leading zeros count), or switch between Active and Closed.
      </EmptyState>
    );
  }
  return (
    <EmptyState icon={closed ? "archive" : "route"} title={closed ? "No closed referrals yet" : "No active referrals"} compact>
      {closed ? "Referrals appear here once they reach a final status." : "New referrals appear here as soon as they are created."}
    </EmptyState>
  );
}

function TabLink({ href, active, count, children }: { href: string; active: boolean; count: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`flex items-center gap-2 rounded-[9px] px-3.5 py-1.5 text-sm font-medium transition duration-fast ${
        active ? "bg-white text-navy shadow-surface" : "text-muted hover:text-ink"
      }`}
    >
      {children}
      <span className={`num rounded-full px-1.5 text-2xs ${active ? "bg-navy text-white" : "bg-line text-muted"}`}>{count}</span>
    </Link>
  );
}
