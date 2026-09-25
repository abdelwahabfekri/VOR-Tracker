"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentStatus, DocumentStatus, ReferringProvider } from "@/lib/types";
import { APPT_LABEL, DOC_LABEL } from "@/lib/types";
import { createExistingReferral } from "@/lib/actions";
import {
  EXISTING_APPT_STATES,
  UNAVAILABLE_REASONS,
  docOptionsFor,
  neededFields,
  suggestedDueForExisting,
  validateExisting,
  type ExistingReferralInput,
} from "@/lib/existingReferral";
import { Card, CodeChip } from "@/components/ui";
import { fmtDateTime, isoToNyInput, nyInputToIso } from "@/lib/tz";

const input =
  "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-star focus:ring-2 focus:ring-star/20";
const label = "mb-1 block text-sm font-medium text-ink";

const today = () => isoToNyInput(new Date().toISOString()).slice(0, 10);
const dayIso = (ymd: string) => (ymd ? nyInputToIso(`${ymd}T00:00`) : null);
const dtIso = (v: string) => (v ? nyInputToIso(v) : null);

export function ExistingReferralForm({ providers }: { providers: ReferringProvider[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [tried, setTried] = useState(false); // show validation only after a submit attempt

  const [f, setF] = useState({
    mrn: "",
    referring_provider_id: providers[0]?.id ?? "",
    open: "",
    specialist_name: "",
    specialty: "",
    specialist_phone: "",
    specialist_fax: "",
    appointment_state: "referral_created" as AppointmentStatus,
    document_state: "awaiting_appointment" as DocumentStatus,
    contact_attempts: "0",
    reschedule_count: "0",
    document_attempts: "0",
    slot: "",
    last_action: "",
    completed: "",
    closed: "",
    unavailable_reason: "",
    due: "", // empty = use the suggestion
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  function setAppt(a: AppointmentStatus) {
    const opts = docOptionsFor(a);
    setF((s) => ({ ...s, appointment_state: a, document_state: opts.includes(s.document_state) ? s.document_state : opts[0], due: "" }));
  }

  const need = neededFields(f.appointment_state, f.document_state);
  const payload: ExistingReferralInput = {
    mrn: f.mrn.trim(),
    referring_provider_id: f.referring_provider_id,
    referral_date: dayIso(f.open) ?? "",
    specialist_name: f.specialist_name,
    specialty: f.specialty,
    specialist_phone: f.specialist_phone,
    specialist_fax: f.specialist_fax,
    appointment_state: f.appointment_state,
    document_state: f.document_state,
    contact_attempts: need.contactAttempts ? Number(f.contact_attempts) : 0,
    reschedule_count: need.rescheduleCount ? Number(f.reschedule_count) : 0,
    document_attempts: need.documentAttempts ? Number(f.document_attempts) : 0,
    appointment_slot: need.slot ? dtIso(f.slot) : null,
    last_action_at: dayIso(f.last_action),
    completed_at: need.completedAt ? dtIso(f.completed) : null,
    closed_at: need.closedAt ? dayIso(f.closed) : null,
    unavailable_reason: need.unavailableReason ? f.unavailable_reason || null : null,
    next_action_due: need.nextActionDue && f.due ? dtIso(f.due) : null,
  };

  const problem = f.open ? validateExisting(payload) : "Enter the original open date.";
  const suggested = !problem && need.nextActionDue ? suggestedDueForExisting(payload) : null;
  const effectiveDue = need.nextActionDue ? payload.next_action_due ?? suggested : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!payload.mrn) { setError("MRN is required."); return; }
    if (problem) { setError(problem); return; }
    setPending(true);
    setError(null);
    const res = await createExistingReferral(payload);
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not save. Try again."); return; }
    setCreated(res.code ?? null);
  }

  if (created) {
    return (
      <Card className="p-7 text-center">
        <div className="text-2xl">✓</div>
        <h2 className="mt-2 text-lg font-semibold text-ink">Existing referral added</h2>
        <p className="mt-1 text-sm text-muted">Tracking code</p>
        <div className="mt-4 flex justify-center"><CodeChip code={created} big /></div>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={() => window.location.reload()} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-navy hover:border-star">
            Add another
          </button>
          <button onClick={() => router.push(`/tracking/${created}`)} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700">
            Open referral
          </button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Step n={1} title="Basic details">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={label}>MRN</label>
            <input className={`${input} font-mono`} value={f.mrn} onChange={(e) => set("mrn", e.target.value)} maxLength={32} required autoComplete="off" />
          </div>
          <div>
            <label className={label}>Internal provider</label>
            <select className={input} value={f.referring_provider_id} onChange={(e) => set("referring_provider_id", e.target.value)} required>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Original open date <span className="text-muted">(ET)</span></label>
            <input type="date" className={input} value={f.open} max={today()} onChange={(e) => set("open", e.target.value)} required />
          </div>
          <div>
            <label className={label}>Specialist name</label>
            <input className={input} value={f.specialist_name} onChange={(e) => set("specialist_name", e.target.value)} />
          </div>
          <div>
            <label className={label}>Specialty</label>
            <input className={input} value={f.specialty} onChange={(e) => set("specialty", e.target.value)} />
          </div>
          <div>
            <label className={label}>Specialist phone <span className="text-muted">(optional)</span></label>
            <input className={`${input} font-mono`} value={f.specialist_phone} onChange={(e) => set("specialist_phone", e.target.value)} />
          </div>
          <div>
            <label className={label}>Specialist fax <span className="text-muted">(optional)</span></label>
            <input className={`${input} font-mono`} value={f.specialist_fax} onChange={(e) => set("specialist_fax", e.target.value)} />
          </div>
        </div>
      </Step>

      <Step n={2} title="Current appointment status">
        <select className={input} value={f.appointment_state} onChange={(e) => setAppt(e.target.value as AppointmentStatus)}>
          {EXISTING_APPT_STATES.map((s) => <option key={s} value={s}>{APPT_LABEL[s]}</option>)}
        </select>
      </Step>

      <Step n={3} title="Current records status">
        {f.appointment_state === "appointment_completed" ? (
          <select className={input} value={f.document_state} onChange={(e) => { set("document_state", e.target.value); set("due", ""); }}>
            {docOptionsFor(f.appointment_state).map((s) => <option key={s} value={s}>{DOC_LABEL[s]}</option>)}
          </select>
        ) : (
          <p className="text-sm text-muted">Records are tracked after the visit is completed — set to “{DOC_LABEL.awaiting_appointment}”.</p>
        )}
      </Step>

      <Step n={4} title="Dates and counts">
        <div className="grid gap-5 sm:grid-cols-2">
          {need.slot && (
            <div>
              <label className={label}>{f.appointment_state === "appointment_completed" ? "Visit date" : "Appointment date"} <span className="text-muted">(ET)</span></label>
              <input type="datetime-local" className={input} value={f.slot} onChange={(e) => set("slot", e.target.value)} required />
            </div>
          )}
          {need.completedAt && (
            <div>
              <label className={label}>Completed on <span className="text-muted">(optional — defaults to the visit date)</span></label>
              <input type="datetime-local" className={input} value={f.completed} onChange={(e) => set("completed", e.target.value)} />
            </div>
          )}
          {need.closedAt && (
            <div>
              <label className={label}>Closed date <span className="text-muted">(ET)</span></label>
              <input type="date" className={input} value={f.closed} max={today()} onChange={(e) => set("closed", e.target.value)} required />
            </div>
          )}
          {need.unavailableReason && (
            <div>
              <label className={label}>Why records are unavailable</label>
              <select className={input} value={f.unavailable_reason} onChange={(e) => set("unavailable_reason", e.target.value)} required>
                <option value="">Choose…</option>
                {UNAVAILABLE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
          {need.contactAttempts && (
            <Count label="Patient contact attempts so far" value={f.contact_attempts} onChange={(v) => set("contact_attempts", v)} />
          )}
          {need.rescheduleCount && (
            <Count label="Reschedules so far" value={f.reschedule_count} onChange={(v) => set("reschedule_count", v)} />
          )}
          {need.documentAttempts && (
            <Count label="Records follow-ups so far" value={f.document_attempts} onChange={(v) => set("document_attempts", v)} />
          )}
          <div>
            <label className={label}>Last known action date <span className="text-muted">(optional — defaults to the open date)</span></label>
            <input type="date" className={input} value={f.last_action} max={today()} onChange={(e) => set("last_action", e.target.value)} />
          </div>
        </div>

        {need.nextActionDue && (
          <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
            <div className="text-sm text-ink">
              Next follow-up:{" "}
              <span className="font-semibold">{effectiveDue ? fmtDateTime(effectiveDue) : "—"}</span>
              {effectiveDue && new Date(effectiveDue).getTime() <= Date.now() && (
                <span className="ml-2 rounded-md bg-overdue-soft px-1.5 py-0.5 text-xs font-semibold text-overdue">Overdue on save</span>
              )}
              {!f.due && suggested && <span className="ml-2 text-xs text-muted">(suggested)</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input type="datetime-local" className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-star" value={f.due} onChange={(e) => set("due", e.target.value)} />
              {f.due && <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => set("due", "")}>Use suggestion</button>}
            </div>
          </div>
        )}
        {!need.nextActionDue && (
          <p className="mt-4 text-sm text-muted">
            {need.closedAt ? "Final status — no follow-up is scheduled." : "Parked (unable to reach patient) — no follow-up is scheduled; it appears for review."}
          </p>
        )}
      </Step>

      {tried && (error || problem) && (
        <div role="alert" className="rounded-lg bg-overdue-soft px-3 py-2 text-sm text-overdue">{error ?? problem}</div>
      )}

      <div className="rounded-lg bg-canvas px-4 py-3 text-xs text-muted">
        MRN is the only patient identifier stored here. Do not enter patient names, dates of birth, or clinical details in any field.
      </div>

      <button type="submit" disabled={pending} className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60">
        {pending ? "Saving…" : "Add existing referral"}
      </button>
    </form>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs text-white">{n}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Count({ label: text, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={label}>{text}</label>
      <input type="number" min={0} step={1} className={input} value={value} onChange={(e) => onChange(e.target.value)} required />
    </div>
  );
}
