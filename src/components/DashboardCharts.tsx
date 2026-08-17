"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import type { Referral } from "@/lib/types";
import { APPT_LABEL, isActive, closedKind, CLOSED_KIND_LABEL } from "@/lib/types";
import { Card } from "@/components/ui";

const NAVY = "#24507A";
const GREEN = "#2E7D5B";
const STAR = "#2FA4E7";
const SOON = "#B9770E";
const RED = "#C0392B";
const MUTED = "#9AA6B2";

export function DashboardCharts({ referrals }: { referrals: Referral[] }) {
  // Provider volume — Active vs Completed, within the selected range
  const byProvider: Record<string, { Active: number; Completed: number }> = {};
  referrals.forEach((r) => {
    const name = (r.referring_provider_name ?? "Unknown").split(",")[0];
    const bucket = (byProvider[name] ??= { Active: 0, Completed: 0 });
    if (isActive(r)) bucket.Active++;
    else if (closedKind(r) === "completed") bucket.Completed++;
  });
  const providerData = Object.entries(byProvider).map(([name, v]) => ({ name, ...v }));

  // Appointment status mix, within the selected range
  const statusCounts: Record<string, number> = {};
  referrals.forEach((r) => {
    const label = APPT_LABEL[r.appointment_state];
    statusCounts[label] = (statusCounts[label] ?? 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = [NAVY, STAR, GREEN, SOON, MUTED, "#6D6875", "#457B9D", "#8D99AE", "#B23A48"];

  // Aging buckets for open (active) referrals
  const buckets = { "0–3d": 0, "4–7d": 0, "8–14d": 0, "15–30d": 0, "30d+": 0 };
  const now = Date.now();
  referrals.filter(isActive).forEach((r) => {
    const days = (now - new Date(r.referral_date).getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 3) buckets["0–3d"]++;
    else if (days <= 7) buckets["4–7d"]++;
    else if (days <= 14) buckets["8–14d"]++;
    else if (days <= 30) buckets["15–30d"]++;
    else buckets["30d+"]++;
  });
  const agingData = Object.entries(buckets).map(([name, value]) => ({ name, count: value }));

  // How referrals closed, within the selected range
  const CLOSED_COLORS: Record<string, string> = { Completed: GREEN, Incomplete: RED, Declined: MUTED, Cancelled: MUTED };
  const closureCounts: Record<string, number> = { Completed: 0, Incomplete: 0, Declined: 0, Cancelled: 0 };
  referrals.forEach((r) => {
    const kind = closedKind(r);
    if (kind) closureCounts[CLOSED_KIND_LABEL[kind]]++;
  });
  const closureData = Object.entries(closureCounts).map(([name, count]) => ({ name, count }));
  const hasClosures = closureData.some((d) => d.count > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink">Referrals by provider</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={providerData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Active" stackId="a" fill={NAVY} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Completed" stackId="a" fill={GREEN} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink">Appointment status mix</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 11 }}>
              {statusData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink">Open referral aging</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={agingData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill={STAR} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink">How referrals closed</h3>
        {hasClosures ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={closureData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {closureData.map((d) => (
                  <Cell key={d.name} fill={CLOSED_COLORS[d.name]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-[260px] items-center justify-center text-sm text-muted">
            No closed referrals in this range.
          </p>
        )}
      </Card>
    </div>
  );
}
