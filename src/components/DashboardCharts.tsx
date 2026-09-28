"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import type { AppointmentStatus, Referral } from "@/lib/types";
import { APPT_LABEL, isActive, closedKind, CLOSED_KIND_LABEL } from "@/lib/types";
import { Card, EmptyState } from "@/components/ui";

// Theme colors only; each appointment status keeps its meaning
// (blues = in progress, green = done, amber = rescheduled, red = unreachable).
const APPT = "#24507A";
const GREEN = "#2E7D5B";
const STAR = "#2FA4E7";
const RED = "#C0392B";
const MUTED = "#9AA6B2";
const GRID = "#EEF2F6";

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  referral_created: "#BFE4F7",
  patient_contacted: "#8FD0F2",
  awaiting_booking: "#5BBDF0",
  appointment_scheduled: "#2FA4E7",
  appointment_confirmed: "#24507A",
  appointment_completed: "#2E7D5B",
  appointment_rescheduled: "#B9770E",
  patient_not_replying: "#C0392B",
  patient_declined: "#9AA6B2",
  cancelled: "#C9D2DC",
};

const tick = { fontSize: 12, fill: "#6B7684" };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string; payload?: { fill?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-ctl border border-line bg-white/95 px-3 py-2 text-xs shadow-lifted backdrop-blur">
      {label && <div className="mb-1 font-semibold text-ink">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}: <span className="num font-semibold text-ink">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardCharts({ referrals, showClosures }: { referrals: Referral[]; showClosures: boolean }) {
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
  const statusCounts = new Map<AppointmentStatus, number>();
  referrals.forEach((r) => statusCounts.set(r.appointment_state, (statusCounts.get(r.appointment_state) ?? 0) + 1));
  const statusData = Array.from(statusCounts.entries()).map(([k, value]) => ({ name: APPT_LABEL[k], value, fill: STATUS_COLOR[k] }));

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
  const CLOSED_COLORS: Record<string, string> = { Completed: GREEN, Incomplete: RED, Declined: MUTED, Cancelled: "#C9D2DC" };
  const closureCounts: Record<string, number> = { Completed: 0, Incomplete: 0, Declined: 0, Cancelled: 0 };
  referrals.forEach((r) => {
    const kind = closedKind(r);
    if (kind) closureCounts[CLOSED_KIND_LABEL[kind]]++;
  });
  const closureData = Object.entries(closureCounts).map(([name, count]) => ({ name, count }));
  const hasClosures = closureData.some((d) => d.count > 0);

  const empty = referrals.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Referrals by Provider" delay={0}>
        {empty ? <NoData /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={providerData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
              <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(47,164,231,0.06)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              <Bar dataKey="Active" stackId="a" fill={APPT} />
              <Bar dataKey="Completed" stackId="a" fill={GREEN} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Appointment Status Mix" delay={1}>
        {empty ? <NoData /> : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="40%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={2} stroke="#fff">
                {statusData.map((d) => <Cell key={d.name} fill={d.fill} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: 12, lineHeight: "20px" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Open Referral Aging" delay={2}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={agingData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
            <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
            <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(47,164,231,0.06)" }} />
            <Bar dataKey="count" name="Referrals" fill={STAR} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {showClosures && (
        <ChartCard title="How Referrals Closed" delay={3}>
          {hasClosures ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={closureData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(47,164,231,0.06)" }} />
                <Bar dataKey="count" name="Referrals" radius={[6, 6, 0, 0]}>
                  {closureData.map((d) => <Cell key={d.name} fill={CLOSED_COLORS[d.name]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[260px] items-center justify-center">
              <EmptyState icon="archive" title="No Closed Referrals Yet" compact>Closures will be charted here.</EmptyState>
            </div>
          )}
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({ title, delay, children }: { title: string; delay: number; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${120 + delay * 50}ms` }}>
      <Card className="h-full p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink">{title}</h3>
        {children}
      </Card>
    </div>
  );
}

function NoData() {
  return (
    <div className="flex h-[260px] items-center justify-center">
      <EmptyState icon="chart" title="No Referrals in This Range" compact />
    </div>
  );
}
