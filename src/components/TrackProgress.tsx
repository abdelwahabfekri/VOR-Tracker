"use client";

import type { Referral, AppointmentStatus, DocumentStatus } from "@/lib/types";
import { TERMINAL_APPT } from "@/lib/types";

// The full journey as an ordered set of "shipping" stops across both tracks.
const APPT_STOPS: { key: AppointmentStatus; label: string }[] = [
  { key: "referral_created", label: "Created" },
  { key: "patient_contacted", label: "Contacting" },
  { key: "appointment_scheduled", label: "Scheduled" },
  { key: "appointment_confirmed", label: "Confirmed" },
  { key: "appointment_completed", label: "Visit done" },
];
const DOC_STOPS: { key: DocumentStatus; label: string }[] = [
  { key: "documents_requested", label: "Records requested" },
  { key: "documents_received", label: "Records received" },
  { key: "documents_uploaded", label: "Uploaded" },
  { key: "closed", label: "Filed & closed" },
];

const APPT_ORDER: AppointmentStatus[] = APPT_STOPS.map((s) => s.key);
const DOC_ORDER: DocumentStatus[] = DOC_STOPS.map((s) => s.key);

function stateIndex(r: Referral) {
  // appointment index (rescheduled maps to "scheduled" position)
  let ai = APPT_ORDER.indexOf(r.appointment_state);
  if (r.appointment_state === "appointment_rescheduled") ai = APPT_ORDER.indexOf("appointment_scheduled");
  if (r.appointment_state === "patient_not_replying") ai = APPT_ORDER.indexOf("patient_contacted");
  const di = DOC_ORDER.indexOf(r.document_state);
  return { ai, di };
}

export function TrackProgress({ referral }: { referral: Referral }) {
  const { ai, di } = stateIndex(referral);
  const track2Active = referral.appointment_state === "appointment_completed";
  const declined = TERMINAL_APPT.includes(referral.appointment_state);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-[720px] items-start">
        {/* Track 1 */}
        {APPT_STOPS.map((stop, i) => {
          const done = ai > i || (ai === APPT_STOPS.length - 1 && i <= ai);
          const current = ai === i && !track2Active;
          return (
            <Stop
              key={stop.key}
              label={stop.label}
              tone="appt"
              done={ai >= i && !declined}
              current={current && !declined}
              first={i === 0}
              faded={declined}
            />
          );
        })}
        {/* Handoff marker */}
        <div className="flex flex-col items-center px-1 pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-docs">Return leg</div>
          <div className="text-docs">▸</div>
        </div>
        {/* Track 2 */}
        {DOC_STOPS.map((stop, i) => (
          <Stop
            key={stop.key}
            label={stop.label}
            tone="docs"
            done={track2Active === false ? false : di >= i}
            current={track2Active && di === i}
            dormant={!track2Active}
          />
        ))}
      </div>

      {/* exception note */}
      {declined && (
        <p className="mt-2 text-xs font-medium text-muted">
          Journey ended: {referral.appointment_state === "cancelled" ? "cancelled" : "patient declined"}.
        </p>
      )}
    </div>
  );
}

function Stop({
  label, tone, done, current, first, dormant, faded,
}: {
  label: string;
  tone: "appt" | "docs";
  done?: boolean;
  current?: boolean;
  first?: boolean;
  dormant?: boolean;
  faded?: boolean;
}) {
  const color = tone === "appt" ? "appt" : "docs";
  const nodeClass = dormant || faded
    ? "border-line bg-white text-muted"
    : done
    ? `border-${color} bg-${color} text-white`
    : current
    ? `border-${color} bg-white text-${color} ring-4 ring-${color}/15`
    : "border-line bg-white text-muted";

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="flex w-full items-center">
        <div className={`h-0.5 flex-1 ${first ? "opacity-0" : done && !dormant && !faded ? `bg-${color}` : "bg-line"}`} />
        <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${nodeClass}`}>
          {done && !dormant && !faded ? "✓" : "•"}
        </div>
        <div className={`h-0.5 flex-1 ${done && !dormant && !faded ? `bg-${color}` : "bg-line"}`} />
      </div>
      <span className={`mt-1.5 text-center text-[11px] leading-tight ${dormant || faded ? "text-muted" : current ? `text-${color} font-semibold` : done ? "text-ink" : "text-muted"}`}>
        {label}
      </span>
    </div>
  );
}
