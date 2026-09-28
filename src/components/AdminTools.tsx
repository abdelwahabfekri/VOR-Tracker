"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentStatus, DocumentStatus, Referral, ReferringProvider } from "@/lib/types";
import { APPT_LABEL, DOC_LABEL, isActive } from "@/lib/types";
import { correctStatus as previewCorrection, type Correction } from "@/lib/statusEngine";
import { correctStatus, editReferralDetails, performAction } from "@/lib/actions";
import { Card, SectionHeading, InlineError } from "@/components/ui";
import { Dialog } from "@/components/Dialog";
import { Icon, type IconName } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { fmtDateTime, isoToNyInput, nyInputToIso } from "@/lib/tz";

type Panel = "edit" | "followup" | "correct";

const input = "field";
const label = "field-label";
const primaryBtn = "btn btn-primary";

// Admin-only corrections, kept apart from the day-to-day mission actions so
// they are not clicked by accident. Short tasks open as a modal; the longer
// edit form opens as a side drawer (full screen on phones).
export function AdminTools({ referral, providers }: { referral: Referral; providers: ReferringProvider[] }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const close = () => setPanel(null);

  const tools: { key: Panel; label: string; help: string; icon: IconName; show: boolean }[] = [
    { key: "edit", label: "Edit details", help: "MRN, provider, specialist, dates", icon: "edit", show: true },
    { key: "followup", label: "Set follow-up date", help: "Move the next due date only", icon: "clock", show: isActive(referral) },
    { key: "correct", label: "Correct status", help: "Fix a status entered by mistake", icon: "sliders", show: true },
  ];

  return (
    <Card className="p-5 md:p-6" tone="neutral">
      <SectionHeading title="Admin controls" icon="sliders" eyebrow="Administrator" />
      <div className="grid gap-2.5 sm:grid-cols-3">
        {tools.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setPanel(t.key)}
            className="group flex items-start gap-3 rounded-ctl border border-line bg-white p-3 text-left transition duration-fast hover:-translate-y-0.5 hover:border-star/50 hover:shadow-lifted focus-visible:outline-none focus-visible:shadow-glow-star"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy group-hover:bg-star/10 group-hover:text-star">
              <Icon name={t.icon} className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">{t.label}</span>
              <span className="block text-xs text-muted">{t.help}</span>
            </span>
          </button>
        ))}
      </div>

      <Dialog open={panel === "edit"} onClose={close} variant="drawer" title="Edit details"
        description="Changes descriptive details only. Statuses change through actions or Correct status.">
        <EditDetails referral={referral} providers={providers} onDone={close} />
      </Dialog>
      <Dialog open={panel === "followup"} onClose={close} title="Set follow-up date"
        description="Only the date changes — the status stays as it is.">
        <SetFollowup referral={referral} onDone={close} />
      </Dialog>
      <Dialog open={panel === "correct"} onClose={close} title="Correct status"
        description={<>Fixes a status entered by mistake. History is kept: a “Status corrected” entry is added with your reason.</>}>
        <CorrectStatus referral={referral} onDone={close} />
      </Dialog>
    </Card>
  );
}

function useSave() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(fn: () => Promise<{ ok: boolean; error?: string }>, onDone: () => void, done = "Saved.") {
    setPending(true);
    setError(null);
    const res = await fn();
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not save. Try again."); return; } // inputs kept for retry
    router.refresh();
    toast(done);
    onDone();
  }
  return { pending, error, save };
}

function ErrorLine({ error }: { error: string | null }) {
  return <InlineError>{error}</InlineError>;
}

// ---------------------------------------------------------------------------
function EditDetails({ referral, providers, onDone }: { referral: Referral; providers: ReferringProvider[]; onDone: () => void }) {
  const { pending, error, save } = useSave();
  const openYmd = isoToNyInput(referral.referral_date).slice(0, 10);
  const slotEditable = ["appointment_scheduled", "appointment_rescheduled", "appointment_confirmed", "appointment_completed"]
    .includes(referral.appointment_state);
  const [f, setF] = useState({
    mrn: referral.mrn ?? "",
    referring_provider_id: referral.referring_provider_id,
    open: openYmd,
    specialist_name: referral.specialist_name ?? "",
    specialty: referral.specialty ?? "",
    specialist_phone: referral.specialist_phone ?? "",
    specialist_fax: referral.specialist_fax ?? "",
    slot: referral.appointment_slot ? isoToNyInput(referral.appointment_slot) : "",
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save(
      () =>
        editReferralDetails(referral.id, referral.updated_at, {
          mrn: f.mrn,
          referring_provider_id: f.referring_provider_id,
          // unchanged date keeps its original time of day
          referral_date: f.open === openYmd ? referral.referral_date : nyInputToIso(`${f.open}T00:00`),
          specialist_name: f.specialist_name,
          specialty: f.specialty,
          specialist_phone: f.specialist_phone,
          specialist_fax: f.specialist_fax,
          appointment_slot: slotEditable && f.slot ? nyInputToIso(f.slot) : null,
        }),
      onDone,
      "Details saved."
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>MRN</label>
          <input className={`${input} num`} value={f.mrn} onChange={(e) => set("mrn", e.target.value)} maxLength={32} required autoComplete="off" />
        </div>
        <div>
          <label className={label}>Internal provider</label>
          <select className={input} value={f.referring_provider_id} onChange={(e) => set("referring_provider_id", e.target.value)}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            {!providers.some((p) => p.id === referral.referring_provider_id) && (
              <option value={referral.referring_provider_id}>{referral.referring_provider_name}</option>
            )}
          </select>
        </div>
        <div>
          <label className={label}>Original open date (ET)</label>
          <input type="date" className={input} value={f.open} max={isoToNyInput(new Date().toISOString()).slice(0, 10)} onChange={(e) => set("open", e.target.value)} required />
          {f.open !== openYmd && (
            <p className="mt-1 text-xs text-soon">Changing the open date changes aging and the weekly report (NEW THIS WEEK).</p>
          )}
        </div>
        {slotEditable && (
          <div>
            <label className={label}>{referral.appointment_state === "appointment_completed" ? "Visit date" : "Appointment date"} (ET)</label>
            <input type="datetime-local" className={input} value={f.slot} onChange={(e) => set("slot", e.target.value)} required />
            {referral.appointment_state !== "appointment_completed" && f.slot !== (referral.appointment_slot ? isoToNyInput(referral.appointment_slot) : "") && (
              <p className="mt-1 text-xs text-muted">The follow-up call moves with the appointment.</p>
            )}
          </div>
        )}
        <div>
          <label className={label}>Specialist</label>
          <input className={input} value={f.specialist_name} onChange={(e) => set("specialist_name", e.target.value)} />
        </div>
        <div>
          <label className={label}>Specialty</label>
          <input className={input} value={f.specialty} onChange={(e) => set("specialty", e.target.value)} />
        </div>
        <div>
          <label className={label}>Specialist phone</label>
          <input className={`${input} num`} value={f.specialist_phone} onChange={(e) => set("specialist_phone", e.target.value)} />
        </div>
        <div>
          <label className={label}>Specialist fax</label>
          <input className={`${input} num`} value={f.specialist_fax} onChange={(e) => set("specialist_fax", e.target.value)} />
        </div>
      </div>
      <ErrorLine error={error} />
      <button type="submit" className={primaryBtn} disabled={pending}>{pending ? "Saving…" : "Save details"}</button>
    </form>
  );
}

// ---------------------------------------------------------------------------
function SetFollowup({ referral, onDone }: { referral: Referral; onDone: () => void }) {
  const { pending, error, save } = useSave();
  const [due, setDue] = useState(referral.next_action_due ? isoToNyInput(referral.next_action_due) : "");
  const [note, setNote] = useState("");
  const [confirmPast, setConfirmPast] = useState(false);
  const inPast = !!due && new Date(nyInputToIso(due)).getTime() < Date.now();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!due) return;
    if (inPast && !confirmPast) return;
    save(async () => {
      const res = await performAction(referral.id, referral.updated_at, { kind: "set_followup", due: nyInputToIso(due) }, "outbound", note);
      return res;
    }, onDone, "Follow-up date updated.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">
        Current follow-up: <span className="font-medium text-ink">{fmtDateTime(referral.next_action_due)}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>New follow-up (ET)</label>
          <input type="datetime-local" className={input} value={due} onChange={(e) => { setDue(e.target.value); setConfirmPast(false); }} required />
        </div>
        <div>
          <label className={label}>Note (optional)</label>
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Office asked to call back Monday" />
        </div>
      </div>
      {inPast && (
        <label className="flex items-center gap-2 rounded-ctl bg-soon-soft px-3 py-2 text-sm text-soon">
          <input type="checkbox" checked={confirmPast} onChange={(e) => setConfirmPast(e.target.checked)} />
          This date is in the past — the referral will show as overdue right away.
        </label>
      )}
      <ErrorLine error={error} />
      <button type="submit" className={primaryBtn} disabled={pending || !due || (inPast && !confirmPast)}>
        {pending ? "Saving…" : "Set follow-up"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
const APPT_STATES = Object.keys(APPT_LABEL) as AppointmentStatus[];
const DOC_STATES = Object.keys(DOC_LABEL) as DocumentStatus[];
const NEEDS_SLOT: AppointmentStatus[] = ["appointment_scheduled", "appointment_rescheduled", "appointment_confirmed", "appointment_completed"];

function CorrectStatus({ referral, onDone }: { referral: Referral; onDone: () => void }) {
  const { pending, error, save } = useSave();
  const [track, setTrack] = useState<"appointment" | "document">("appointment");
  const [to, setTo] = useState<string>("");
  const [slot, setSlot] = useState(referral.appointment_slot ? isoToNyInput(referral.appointment_slot) : "");
  const [completed, setCompleted] = useState(referral.completed_at ? isoToNyInput(referral.completed_at) : "");
  const [reason, setReason] = useState("");

  const current = track === "appointment" ? referral.appointment_state : referral.document_state;
  const options = (track === "appointment" ? APPT_STATES : DOC_STATES).filter((s) => s !== current);
  const labelOf = (t: string, s: string | null) =>
    s ? (t === "appointment" ? APPT_LABEL[s as AppointmentStatus] : DOC_LABEL[s as DocumentStatus]) : "—";

  const correction: Correction | null = !to
    ? null
    : track === "appointment"
      ? {
          track,
          to: to as AppointmentStatus,
          slot: NEEDS_SLOT.includes(to as AppointmentStatus) && slot ? nyInputToIso(slot) : undefined,
          completedAt: to === "appointment_completed" && completed ? nyInputToIso(completed) : undefined,
        }
      : { track, to: to as DocumentStatus };

  // Same pure function the server runs — the preview is what will be saved.
  let preview: { result: ReturnType<typeof previewCorrection> } | { problem: string } | null = null;
  if (correction) {
    try {
      preview = { result: previewCorrection(referral, correction) };
    } catch (e) {
      preview = { problem: (e as Error).message };
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!correction || !preview || "problem" in preview || !reason.trim()) return;
    save(() => correctStatus(referral.id, referral.updated_at, correction, reason), onDone, "Status corrected.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Track</label>
          <select className={input} value={track} onChange={(e) => { setTrack(e.target.value as "appointment" | "document"); setTo(""); }}>
            <option value="appointment">Appointment</option>
            <option value="document">Records</option>
          </select>
        </div>
        <div>
          <label className={label}>Current → correct status</label>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm text-ink">{labelOf(track, current)} →</span>
            <select className={input} value={to} onChange={(e) => setTo(e.target.value)} required>
              <option value="">Choose…</option>
              {options.map((s) => <option key={s} value={s}>{labelOf(track, s)}</option>)}
            </select>
          </div>
        </div>
        {track === "appointment" && NEEDS_SLOT.includes(to as AppointmentStatus) && (
          <div>
            <label className={label}>{to === "appointment_completed" ? "Visit date" : "Appointment date"} (ET)</label>
            <input type="datetime-local" className={input} value={slot} onChange={(e) => setSlot(e.target.value)} required />
          </div>
        )}
        {track === "appointment" && to === "appointment_completed" && (
          <div>
            <label className={label}>Completed on (ET, optional — defaults to the visit date)</label>
            <input type="datetime-local" className={input} value={completed} onChange={(e) => setCompleted(e.target.value)} />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className={label}>Reason (required)</label>
          <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Visit done was clicked on the wrong referral" required />
        </div>
      </div>

      {preview && "problem" in preview && (
        <div className="rounded-ctl bg-soon-soft px-3 py-2 text-sm text-soon">{preview.problem}</div>
      )}
      {preview && "result" in preview && (
        <div className="rounded-ctl border border-line bg-canvas px-3 py-2.5 text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Preview</div>
          <ul className="space-y-0.5 text-ink">
            {preview.result.events.map((ev, i) => (
              <li key={i}>
                {ev.track === "appointment" ? "Appointment" : "Records"}: {labelOf(ev.track, ev.from)} → {labelOf(ev.track, ev.to)}
                {i > 0 && <span className="text-muted"> (follows from the change above)</span>}
              </li>
            ))}
            <li className="text-muted">Next follow-up: {fmtDateTime(preview.result.fields.next_action_due ?? null)}</li>
          </ul>
        </div>
      )}

      <ErrorLine error={error} />
      <button
        type="submit"
        className="btn btn-danger-solid"
        disabled={pending || !preview || "problem" in preview || !reason.trim()}
      >
        {pending ? "Saving…" : "Confirm correction"}
      </button>
    </form>
  );
}
