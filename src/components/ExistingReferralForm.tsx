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
import { Card, ApptChip, DocChip, InlineError, Mrn, Spinner } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { PrivacyNote, SuccessCard } from "@/components/NewReferralForm";
import { fmtDate, fmtDateTime, isoToNyInput, nyInputToIso } from "@/lib/tz";

const input = "field";
const label = "field-label";

const today = () => isoToNyInput(new Date().toISOString()).slice(0, 10);
const dayIso = (ymd: string) => (ymd ? nyInputToIso(`${ymd}T00:00`) : null);
const dtIso = (v: string) => (v ? nyInputToIso(v) : null);

export function ExistingReferralForm({ providers }: { providers: ReferringProvider[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [tried, setTried] = useState(false); // show validation only after a submit attempt
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

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

  // What blocks leaving each step (null = fine).
  function blocker(i: number): string | null {
    if (i === 0) {
      if (!f.mrn.trim()) return "Enter the MRN.";
      if (!f.referring_provider_id) return "Pick the internal provider.";
      if (!f.open) return "Enter the original open date.";
    }
    if (i === 3 && problem) return problem;
    return null;
  }

  function next() {
    const b = blocker(step);
    if (b) { setStepError(b); return; }
    setStepError(null);
    setStep((n) => Math.min(n + 1, STEPS.length - 1));
  }

  function back() {
    setStepError(null);
    setStep((n) => Math.max(n - 1, 0));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step < STEPS.length - 1) { next(); return; }
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
      <SuccessCard
        title="Existing Referral Added"
        mrn={payload.mrn}
        code={created}
        onAnother={() => window.location.reload()}
        onOpen={() => router.push(`/tracking/${created}`)}
      />
    );
  }

  const provider = providers.find((p) => p.id === f.referring_provider_id);

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Stepper step={step} onJump={(i) => { if (i < step) { setStepError(null); setStep(i); } }} />

      {step === 0 && (
        <StepCard i={0}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="ex-mrn" className={label}>MRN</label>
              <input id="ex-mrn" className={`${input} num`} value={f.mrn} onChange={(e) => set("mrn", e.target.value)} maxLength={32} required autoComplete="off" />
            </div>
            <div>
              <label htmlFor="ex-provider" className={label}>Internal provider</label>
              <select id="ex-provider" className={input} value={f.referring_provider_id} onChange={(e) => set("referring_provider_id", e.target.value)} required>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ex-open" className={label}>Original open date</label>
              <input id="ex-open" type="date" className={`${input} num`} value={f.open} max={today()} onChange={(e) => set("open", e.target.value)} required />
            </div>
            <div>
              <label htmlFor="ex-sname" className={label}>Specialist name</label>
              <input id="ex-sname" className={input} value={f.specialist_name} onChange={(e) => set("specialist_name", e.target.value)} />
            </div>
            <div>
              <label htmlFor="ex-spec" className={label}>Specialty</label>
              <input id="ex-spec" className={input} value={f.specialty} onChange={(e) => set("specialty", e.target.value)} />
            </div>
            <div>
              <label htmlFor="ex-phone" className={label}>Specialist phone <span className="font-normal text-muted">(optional)</span></label>
              <input id="ex-phone" className={`${input} num`} value={f.specialist_phone} onChange={(e) => set("specialist_phone", e.target.value)} />
            </div>
            <div>
              <label htmlFor="ex-fax" className={label}>Specialist fax <span className="font-normal text-muted">(optional)</span></label>
              <input id="ex-fax" className={`${input} num`} value={f.specialist_fax} onChange={(e) => set("specialist_fax", e.target.value)} />
            </div>
          </div>
        </StepCard>
      )}

      {step === 1 && (
        <StepCard i={1}>
          <label htmlFor="ex-appt" className={label}>Appointment status today</label>
          <select id="ex-appt" className={input} value={f.appointment_state} onChange={(e) => setAppt(e.target.value as AppointmentStatus)}>
            {EXISTING_APPT_STATES.map((s) => <option key={s} value={s}>{APPT_LABEL[s]}</option>)}
          </select>
        </StepCard>
      )}

      {step === 2 && (
        <StepCard i={2}>
          {f.appointment_state === "appointment_completed" ? (
            <>
              <label htmlFor="ex-doc" className={label}>Records status today</label>
              <select id="ex-doc" className={input} value={f.document_state} onChange={(e) => { set("document_state", e.target.value); set("due", ""); }}>
                {docOptionsFor(f.appointment_state).map((s) => <option key={s} value={s}>{DOC_LABEL[s]}</option>)}
              </select>
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-ctl bg-canvas px-3.5 py-3 text-sm text-muted ring-1 ring-inset ring-line">
              <Icon name="lock" className="h-4 w-4" />
              Records are tracked after the visit is completed — set to “{DOC_LABEL.awaiting_appointment}”.
            </p>
          )}
        </StepCard>
      )}

      {step === 3 && (
        <StepCard i={3}>
          <div className="grid gap-5 sm:grid-cols-2">
            {need.slot && (
              <div>
                <label htmlFor="ex-slot" className={label}>{f.appointment_state === "appointment_completed" ? "Visit date" : "Appointment date"}</label>
                <input id="ex-slot" type="datetime-local" className={input} value={f.slot} onChange={(e) => set("slot", e.target.value)} required />
              </div>
            )}
            {need.completedAt && (
              <div>
                <label htmlFor="ex-completed" className={label}>Completed on <span className="font-normal text-muted">(optional — defaults to the visit date)</span></label>
                <input id="ex-completed" type="datetime-local" className={input} value={f.completed} onChange={(e) => set("completed", e.target.value)} />
              </div>
            )}
            {need.closedAt && (
              <div>
                <label htmlFor="ex-closed" className={label}>Closed date</label>
                <input id="ex-closed" type="date" className={input} value={f.closed} max={today()} onChange={(e) => set("closed", e.target.value)} required />
              </div>
            )}
            {need.unavailableReason && (
              <div>
                <label htmlFor="ex-reason" className={label}>Why records are unavailable</label>
                <select id="ex-reason" className={input} value={f.unavailable_reason} onChange={(e) => set("unavailable_reason", e.target.value)} required>
                  <option value="">Choose…</option>
                  {UNAVAILABLE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
            {need.contactAttempts && (
              <Count id="ex-ca" label="Patient contact attempts so far" value={f.contact_attempts} onChange={(v) => set("contact_attempts", v)} />
            )}
            {need.rescheduleCount && (
              <Count id="ex-rc" label="Reschedules so far" value={f.reschedule_count} onChange={(v) => set("reschedule_count", v)} />
            )}
            {need.documentAttempts && (
              <Count id="ex-da" label="Records follow-ups so far" value={f.document_attempts} onChange={(v) => set("document_attempts", v)} />
            )}
            <div>
              <label htmlFor="ex-last" className={label}>Last known action date <span className="font-normal text-muted">(optional — defaults to the open date)</span></label>
              <input id="ex-last" type="date" className={input} value={f.last_action} max={today()} onChange={(e) => set("last_action", e.target.value)} />
            </div>
          </div>

          {need.nextActionDue && (
            <div className="mt-5 rounded-ctl border border-line bg-canvas p-4">
              <div className="text-sm text-ink">
                Next follow-up:{" "}
                <span className="font-semibold">{effectiveDue ? fmtDateTime(effectiveDue) : "—"}</span>
                {effectiveDue && new Date(effectiveDue).getTime() <= Date.now() && (
                  <span className="ml-2 rounded-md bg-overdue-soft px-1.5 py-0.5 text-xs font-semibold text-overdue">Overdue on save</span>
                )}
                {!f.due && suggested && <span className="ml-2 text-xs text-muted">(suggested)</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label htmlFor="ex-due" className="sr-only">Override next follow-up</label>
                <input id="ex-due" type="datetime-local" className="field field-sm w-auto" value={f.due} onChange={(e) => set("due", e.target.value)} />
                {f.due && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("due", "")}>Use Suggestion</button>}
              </div>
            </div>
          )}
          {!need.nextActionDue && (
            <p className="mt-4 text-sm text-muted">
              {need.closedAt ? "Final status — no follow-up is scheduled." : "Parked (unable to reach patient) — no follow-up is scheduled; it appears for review."}
            </p>
          )}
        </StepCard>
      )}

      {step === 4 && (
        <StepCard i={4}>
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <Summary label="MRN"><Mrn value={payload.mrn} /></Summary>
            <Summary label="Internal provider">{provider?.name ?? "—"}</Summary>
            <Summary label="Original open date">{payload.referral_date ? fmtDate(payload.referral_date) : "—"}</Summary>
            <Summary label="Specialist">{[f.specialist_name, f.specialty].filter(Boolean).join(" · ") || "—"}</Summary>
            <Summary label="Appointment status"><ApptChip state={f.appointment_state} /></Summary>
            <Summary label="Records status"><DocChip state={f.document_state} /></Summary>
            {need.slot && <Summary label={f.appointment_state === "appointment_completed" ? "Visit date" : "Appointment date"}>{fmtDateTime(payload.appointment_slot)}</Summary>}
            {need.closedAt && <Summary label="Closed date">{payload.closed_at ? fmtDate(payload.closed_at) : "—"}</Summary>}
            {need.nextActionDue && <Summary label="Next follow-up">{effectiveDue ? fmtDateTime(effectiveDue) : "—"}</Summary>}
          </dl>
          <p className="mt-5 text-xs text-muted">
            Saved at this stage with one “Added to tracker at current stage” entry — earlier steps are not recreated.
          </p>
        </StepCard>
      )}

      {(stepError || (tried && (error || problem))) && (
        <InlineError>{stepError ?? error ?? problem}</InlineError>
      )}

      <PrivacyNote />

      <div className="flex items-center justify-between gap-3">
        <button type="button" className="btn btn-ghost" onClick={back} disabled={step === 0}>
          <Icon name="arrowLeft" className="h-4 w-4" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={next}>
            Continue <Icon name="arrowRight" className="btn-icon h-4 w-4" />
          </button>
        ) : (
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? <><Spinner className="h-4 w-4" /> Saving…</> : <>Add Existing Referral <Icon name="check" className="h-4 w-4" /></>}
          </button>
        )}
      </div>
    </form>
  );
}

const STEPS: { title: string; description: string; icon: IconName }[] = [
  { title: "Basic Details", description: "MRN, provider, open date and specialist.", icon: "user" },
  { title: "Appointment Status", description: "Where the appointment stands today.", icon: "calendar" },
  { title: "Records Status", description: "Only after the visit is completed.", icon: "file" },
  { title: "Dates and Counts", description: "What already happened, so follow-ups start in the right place.", icon: "clock" },
  { title: "Review", description: "Check everything before saving.", icon: "check" },
];

function Stepper({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <nav aria-label="Progress">
      <p className="mb-2 text-xs font-medium text-muted">Step <span className="num">{step + 1}</span> of <span className="num">{STEPS.length}</span></p>
      <ol className="flex gap-1.5">
        {STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo";
          return (
            <li key={s.title} className="flex-1">
              <button
                type="button"
                onClick={() => onJump(i)}
                disabled={i >= step}
                aria-current={state === "current" ? "step" : undefined}
                className="group w-full text-left disabled:cursor-default"
              >
                <span className={`block h-1.5 rounded-full transition-colors duration-milestone ${
                  state === "done" ? "bg-appt" : state === "current" ? "bg-star" : "bg-line"
                }`} />
                <span className={`mt-2 hidden items-center gap-1.5 text-xs font-medium md:flex ${
                  state === "current" ? "text-navy" : state === "done" ? "text-ink group-hover:text-star" : "text-muted"
                }`}>
                  <Icon name={state === "done" ? "check" : s.icon} className="h-3.5 w-3.5" />
                  {s.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepCard({ i, children }: { i: number; children: React.ReactNode }) {
  const s = STEPS[i];
  return (
    <Card className="animate-fade-up p-6 md:p-7" key={i}>
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-track-appt text-white">
          <Icon name={s.icon} className="h-[18px] w-[18px]" />
        </span>
        <div>
          <div className="eyebrow">Step {i + 1} of {STEPS.length}</div>
          <h2 className="text-base font-semibold text-ink">{s.title}</h2>
          <p className="text-sm text-muted">{s.description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function Summary({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{text}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}

function Count({ id, label: text, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={label}>{text}</label>
      <input id={id} type="number" min={0} step={1} className={`${input} num`} value={value} onChange={(e) => onChange(e.target.value)} required />
    </div>
  );
}
