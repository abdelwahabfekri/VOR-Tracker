import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getMe, getReferralByCode, getHistory } from "@/lib/data";
import { TrackProgress } from "@/components/TrackProgress";
import { CodeChip, ApptChip, DocChip, AttemptBadge, Card } from "@/components/ui";
import { CAPS } from "@/lib/statusEngine";
import { DetailActions } from "@/components/DetailActions";
import { ScanHistory } from "@/components/ScanHistory";

export default async function ReferralDetail({ params }: { params: { code: string } }) {
  const me = await getMe();
  if (!me) redirect("/login");

  const referral = await getReferralByCode(params.code);
  if (!referral) notFound();
  const history = await getHistory(referral.id);
  const isAdmin = me.role === "admin";
  const dormant = referral.document_state === "awaiting_appointment";

  return (
    <div>
      <Link href="/tracking" className="text-sm text-muted hover:text-navy">← Back to tracking</Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <CodeChip code={referral.code} big />
            <span className="text-sm text-muted">Tracking number</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ApptChip state={referral.appointment_state} />
            <DocChip state={referral.document_state} dormant={dormant} />
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted">Referring provider</div>
          <div className="font-medium text-ink">{referral.referring_provider_name}</div>
        </div>
      </div>

      {/* Journey */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Journey</h2>
        <TrackProgress referral={referral} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: details + actions */}
        <div className="space-y-6 lg:col-span-2">
          {isAdmin && <DetailActions referral={referral} />}

          {/* Specialist reference (destination) */}
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Destination — specialist</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Specialist" value={referral.specialist_name} />
              <Field label="Specialty" value={referral.specialty} />
              <Field label="Phone" value={referral.specialist_phone} mono />
              <Field label="Fax" value={referral.specialist_fax} mono />
            </dl>
          </Card>

          {/* Operational meta */}
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Opened" value={fmt(referral.referral_date)} />
              <Field label="Appointment slot" value={referral.appointment_slot ? fmt(referral.appointment_slot) : null} />
              <Field label="Last update" value={fmt(referral.last_action_at)} />
              <Field label="Completed" value={referral.completed_at ? fmt(referral.completed_at) : null} />
              <div>
                <dt className="text-muted">Contact attempts</dt>
                <dd className="mt-0.5"><AttemptBadge n={referral.contact_attempts} cap={CAPS.contact} label="Contact" /></dd>
              </div>
              <div>
                <dt className="text-muted">Reschedules</dt>
                <dd className="mt-0.5"><AttemptBadge n={referral.reschedule_count} cap={CAPS.reschedule} label="Reschedule" /></dd>
              </div>
              <div>
                <dt className="text-muted">Record chases</dt>
                <dd className="mt-0.5"><AttemptBadge n={referral.document_attempts} cap={CAPS.document} label="Chase" /></dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* Right: scan history */}
        <div>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Tracking history</h2>
            <ScanHistory entries={history} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className={`mt-0.5 text-ink ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}
