"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProviderEmail } from "@/lib/actions";
import { Card } from "@/components/ui";

type Copyable = { html: string; text: string };

// Put HTML and plain text on the clipboard together so Outlook pastes the
// formatted table and plain-text targets still get something readable.
// Returns false when the browser refuses — the caller must not claim success.
async function copyRich(c: Copyable): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([c.html], { type: "text/html" }),
          "text/plain": new Blob([c.text], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(c.text);
    return true;
  } catch {
    return false;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function WeeklyReportView(props: {
  providers: { id: string; name: string }[];
  provider: { id: string; name: string; email: string | null };
  startYmd: string;
  endYmd: string;
  todayYmd: string;
  periodText: string;
  showChange: boolean;
  rowCount: number;
  subject: string;
  email: Copyable;
  table: Copyable;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<{ key: string; ok: boolean } | null>(null);
  const [manual, setManual] = useState<string | null>(null); // fallback text to copy by hand

  function go(next: Partial<{ provider: string; start: string; end: string; change: string }>) {
    const q = new URLSearchParams({
      provider: props.provider.id,
      start: props.startYmd,
      end: props.endYmd,
      change: props.showChange ? "1" : "0",
      ...next,
    });
    router.push(`/reports/weekly?${q.toString()}`);
  }

  async function run(key: string, fn: () => Promise<boolean>, fallback: string) {
    const ok = await fn();
    setStatus({ key, ok });
    setManual(ok ? null : fallback);
    if (ok) setTimeout(() => setStatus((s) => (s?.key === key ? null : s)), 1800);
  }

  const btn = "rounded-lg border border-line px-3 py-2 text-sm font-medium text-navy hover:border-star disabled:opacity-50";
  const label = (key: string, text: string) =>
    status?.key === key ? (status.ok ? "Copied ✓" : "Copy failed") : text;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">Internal provider</label>
            <select
              value={props.provider.id}
              onChange={(e) => go({ provider: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-star"
            >
              {props.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">From (ET)</label>
            <input type="date" value={props.startYmd} max={props.endYmd} onChange={(e) => e.target.value && go({ start: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-star" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">To (ET)</label>
            <input type="date" value={props.endYmd} max={props.todayYmd} onChange={(e) => e.target.value && go({ end: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-star" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-ink">
            <input type="checkbox" checked={props.showChange} onChange={(e) => go({ change: e.target.checked ? "1" : "0" })} />
            Include weekly change summary
          </label>
          <span className="text-muted">{props.periodText} · {props.rowCount} referral{props.rowCount === 1 ? "" : "s"}</span>
        </div>
        {props.endYmd !== props.todayYmd && (
          <p className="mt-3 rounded-lg bg-soon-soft px-3 py-2 text-xs text-soon">
            Statuses and follow-up tags always show today’s state; only the activity tags and change summary use the chosen dates.
          </p>
        )}
      </Card>

      {/* Recipient */}
      <Card className="p-5">
        <RecipientEditor key={props.provider.id} provider={props.provider} onCopy={(email) => run("recipient", () => copyText(email), email)} copyLabel={label("recipient", "Copy recipient")} />
      </Card>

      {/* Subject + actions */}
      <Card className="p-5">
        <div className="mb-1 text-xs font-medium text-muted">Subject</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink">{props.subject}</div>
          <button className={btn} onClick={() => run("subject", () => copyText(props.subject), props.subject)}>{label("subject", "Copy subject")}</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            onClick={() => run("email", () => copyRich(props.email), props.email.text)}>
            {label("email", "Copy email")}
          </button>
          <button className={btn} onClick={() => run("table", () => copyRich(props.table), props.table.text)}>{label("table", "Copy table only")}</button>
        </div>
        {manual !== null && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-overdue">
              The browser blocked clipboard access. Click in the box, press Ctrl+A (⌘A on Mac), then Ctrl+C (⌘C) to copy.
            </p>
            <textarea readOnly value={manual} onFocus={(e) => e.currentTarget.select()}
              className="h-48 w-full rounded-lg border border-line p-3 font-mono text-xs" />
          </div>
        )}
      </Card>

      {/* Preview */}
      <Card className="p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Email preview</div>
        {/* Generated by weeklyReport.ts — every value is HTML-escaped there. */}
        <div className="overflow-x-auto rounded-lg border border-line bg-white p-4" dangerouslySetInnerHTML={{ __html: props.email.html }} />
      </Card>
    </div>
  );
}

function RecipientEditor({
  provider,
  onCopy,
  copyLabel,
}: {
  provider: { id: string; name: string; email: string | null };
  onCopy: (email: string) => void;
  copyLabel: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(provider.email ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    const res = await updateProviderEmail(provider.id, value);
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not save. Try again."); return; }
    setEditing(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted">Recipient — {provider.name}</div>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input type="email" value={value} onChange={(e) => setValue(e.target.value)} placeholder="name@organization.org"
            className="min-w-[260px] flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-star" autoFocus />
          <button onClick={save} disabled={pending} className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? "Saving…" : "Save"}
          </button>
          <button onClick={() => { setEditing(false); setValue(provider.email ?? ""); setError(null); }} className="text-sm text-muted hover:text-ink">Cancel</button>
        </div>
      ) : provider.email ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex-1 rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-sm text-ink">{provider.email}</span>
          <button onClick={() => onCopy(provider.email as string)} className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-navy hover:border-star">{copyLabel}</button>
          <button onClick={() => setEditing(true)} className="text-sm text-muted hover:text-ink">Edit</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-soon-soft px-3 py-2 text-sm text-soon">
          No report email saved for this provider. You can still preview and copy the report.
          <button onClick={() => setEditing(true)} className="font-semibold underline">Add email</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-overdue">{error}</p>}
    </div>
  );
}
