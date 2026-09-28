"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProviderEmail } from "@/lib/actions";
import { Card, InlineError } from "@/components/ui";
import { Icon } from "@/components/Icon";

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

  const copied = (key: string) => status?.key === key && status.ok;
  const label = (key: string, text: string) =>
    status?.key === key ? (status.ok ? "Copied" : "Copy failed") : text;
  const copyBtn = (key: string, text: string) => (
    <>
      <Icon name={copied(key) ? "check" : "copy"} className={`h-4 w-4 ${copied(key) ? "animate-check-pop" : ""}`} strokeWidth={copied(key) ? 2.4 : 1.8} />
      {label(key, text)}
    </>
  );
  const flash = (key: string) => (copied(key) ? "animate-flash-ok" : "");

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <Card className="p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label htmlFor="wr-provider" className="field-label">Internal provider</label>
            <select id="wr-provider" value={props.provider.id} onChange={(e) => go({ provider: e.target.value })} className="field">
              {props.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="wr-from" className="field-label">From <span className="font-normal text-muted">(ET)</span></label>
            <input id="wr-from" type="date" value={props.startYmd} max={props.endYmd} onChange={(e) => e.target.value && go({ start: e.target.value })} className="field num" />
          </div>
          <div>
            <label htmlFor="wr-to" className="field-label">To <span className="font-normal text-muted">(ET)</span></label>
            <input id="wr-to" type="date" value={props.endYmd} max={props.todayYmd} onChange={(e) => e.target.value && go({ end: e.target.value })} className="field num" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-4 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-appt-soft px-3 py-1 text-xs font-semibold text-appt">
            <Icon name="calendar" className="h-3.5 w-3.5" />
            {props.periodText} · <span className="num">{props.rowCount}</span> referral{props.rowCount === 1 ? "" : "s"}
          </span>
          <label className="flex items-center gap-2 text-ink">
            <input type="checkbox" className="h-4 w-4 accent-navy" checked={props.showChange} onChange={(e) => go({ change: e.target.checked ? "1" : "0" })} />
            Include weekly change summary
          </label>
        </div>
        {props.endYmd !== props.todayYmd && (
          <p className="mt-3 flex items-start gap-2 rounded-ctl bg-soon-soft px-3 py-2 text-xs text-soon">
            <Icon name="info" className="mt-px h-3.5 w-3.5" />
            Statuses and follow-up tags always show today’s state; only the activity tags and change summary use the chosen dates.
          </p>
        )}
      </Card>

      {/* Copy actions — in the order you use them */}
      <Card className="p-4 md:p-5">
        <RecipientEditor key={props.provider.id} provider={props.provider} onCopy={(email) => run("recipient", () => copyText(email), email)} copyLabel={label("recipient", "Copy recipient")} copied={copied("recipient")} />
        <div className="mt-4">
          <div className="field-label">Subject</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 rounded-ctl border border-line bg-canvas px-3 py-2.5 text-sm text-ink">{props.subject}</div>
            <button className={`btn btn-secondary ${flash("subject")}`} onClick={() => run("subject", () => copyText(props.subject), props.subject)}>{copyBtn("subject", "Copy subject")}</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className={`btn btn-primary ${flash("email")}`} onClick={() => run("email", () => copyRich(props.email), props.email.text)}>
            {copyBtn("email", "Copy email")}
          </button>
          <button className={`btn btn-secondary ${flash("table")}`} onClick={() => run("table", () => copyRich(props.table), props.table.text)}>{copyBtn("table", "Copy table only")}</button>
          <span className="text-xs text-muted">Paste into Outlook — the table keeps its formatting.</span>
        </div>
        {manual !== null && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-overdue">
              The browser blocked clipboard access. Click in the box, press Ctrl+A (⌘A on Mac), then Ctrl+C (⌘C) to copy.
            </p>
            <textarea readOnly value={manual} onFocus={(e) => e.currentTarget.select()}
              className="field h-48 font-mono text-xs" />
          </div>
        )}
      </Card>

      {/* Preview — a plain, Outlook-like canvas (no glow inside the email) */}
      <section aria-label="Email preview">
        <div className="eyebrow mb-2">Email preview</div>
        <div className="overflow-hidden rounded-xl2 border border-line bg-white shadow-lifted">
          <div className="flex items-center gap-2 border-b border-line bg-table-head px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="ml-2 truncate text-xs text-muted">{props.subject}</span>
          </div>
          <div className="space-y-1 border-b border-line px-5 py-3 text-xs text-muted">
            <div><span className="inline-block w-14">To</span><span className="text-ink">{props.provider.email ?? "—"}</span></div>
            <div><span className="inline-block w-14">Subject</span><span className="text-ink">{props.subject}</span></div>
          </div>
          {/* Generated by weeklyReport.ts — every value is HTML-escaped there. */}
          <div className="overflow-x-auto p-5" dangerouslySetInnerHTML={{ __html: props.email.html }} />
        </div>
      </section>
    </div>
  );
}

function RecipientEditor({
  provider,
  onCopy,
  copyLabel,
  copied,
}: {
  provider: { id: string; name: string; email: string | null };
  onCopy: (email: string) => void;
  copyLabel: string;
  copied: boolean;
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
      <div className="field-label">Recipient <span className="font-normal text-muted">— {provider.name}</span></div>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input type="email" value={value} onChange={(e) => setValue(e.target.value)} placeholder="name@organization.org"
            className="field min-w-[240px] flex-1" autoFocus />
          <button onClick={save} disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Save"}
          </button>
          <button onClick={() => { setEditing(false); setValue(provider.email ?? ""); setError(null); }} className="btn btn-ghost">Cancel</button>
        </div>
      ) : provider.email ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1 truncate rounded-ctl border border-line bg-canvas px-3 py-2.5 text-sm text-ink">{provider.email}</span>
          <button onClick={() => onCopy(provider.email as string)} className={`btn btn-secondary ${copied ? "animate-flash-ok" : ""}`}><Icon name={copied ? "check" : "copy"} className="h-4 w-4" />{copyLabel}</button>
          <button onClick={() => setEditing(true)} className="btn btn-ghost"><Icon name="edit" className="h-4 w-4" />Edit</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-ctl bg-soon-soft px-3 py-2.5 text-sm text-soon">
          No report email saved for this provider. You can still preview and copy the report.
          <button onClick={() => setEditing(true)} className="font-semibold underline">Add email</button>
        </div>
      )}
      {error && <div className="mt-2"><InlineError>{error}</InlineError></div>}
    </div>
  );
}
