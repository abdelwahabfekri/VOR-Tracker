"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import type { Referral } from "@/lib/types";
import { APPT_LABEL } from "@/lib/types";
import { Card } from "@/components/ui";

interface ProviderStat {
  provider_name: string;
  total_referrals: number;
  completed: number;
  active: number;
  completion_rate_pct: number | null;
}

const NAVY = "#24507A";
const GREEN = "#2E7D5B";
const STAR = "#2FA4E7";
const SOON = "#B9770E";
const MUTED = "#9AA6B2";

export function DashboardCharts({
  providerStats,
  referrals,
}: {
  providerStats: ProviderStat[];
  referrals: Referral[];
}) {
  // Provider volume
  const providerData = providerStats.map((p) => ({
    name: p.provider_name.split(",")[0],
    Active: p.active,
    Completed: p.completed,
  }));

  // Appointment status mix (active referrals only)
  const statusCounts: Record<string, number> = {};
  referrals.forEach((r) => {
    const label = APPT_LABEL[r.appointment_state];
    statusCounts[label] = (statusCounts[label] ?? 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = [NAVY, STAR, GREEN, SOON, MUTED, "#6D6875", "#457B9D", "#8D99AE", "#B23A48"];

  // Aging buckets for open referrals
  const buckets = { "0–3d": 0, "4–7d": 0, "8–14d": 0, "15–30d": 0, "30d+": 0 };
  const now = Date.now();
  referrals.forEach((r) => {
    const closed = r.document_state === "closed" || ["patient_declined", "cancelled"].includes(r.appointment_state);
    if (closed) return;
    const days = (now - new Date(r.referral_date).getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 3) buckets["0–3d"]++;
    else if (days <= 7) buckets["4–7d"]++;
    else if (days <= 14) buckets["8–14d"]++;
    else if (days <= 30) buckets["15–30d"]++;
    else buckets["30d+"]++;
  });
  const agingData = Object.entries(buckets).map(([name, value]) => ({ name, count: value }));

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

      <Card className="p-5 lg:col-span-2">
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
    </div>
  );
}
