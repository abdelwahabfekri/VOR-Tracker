import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getMe, getReferralByCode, getHistory, getProviders } from "@/lib/data";
import { ReferralJourney } from "@/components/TrackProgress";
import { CodeChip, ApptChip, DocChip, AttemptBadge, Card, StaleChip, Mrn, SectionHeading } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CAPS, staleTag } from "@/lib/statusEngine";
import { AdminTools } from "@/components/AdminTools";
import { DetailActions } from "@/components/DetailActions";
import { DeleteReferral } from "@/components/DeleteReferral";
import { ScanHistory } from "@/components/ScanHistory";
import { CallLogTable } from "@/components/CallLogTable";
import { NotesSection } from "@/components/NotesSection";
import { fmtDateTime } from "@/lib/tz";

// Order: identity → journey → current mission → details → calls & notes →
// activity timeline → admin controls (kept apart from daily actions).
export default async function ReferralDetail({ params }: { params: { code: string } }) {
  const me = await getMe();
  if (!me) redirect("/login");

  const referral = await getReferralByCode(params.code);
  if (!referral) notFound();
  const isAdmin = me.role === "admin";
  const [history, providers] = await Promise.all([
    getHistory(referral.id),
    isAdmin ? getProviders() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/tracking" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-navy">
        <Icon name="arrowLeft" className="h-4 w-4" /> Back to Tracking
      </Link>

      {/* 1. Identity */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="eyebrow">MRN</div>
            <Mrn value={referral.mrn} className="text-2xl md:text-[28px]" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CodeChip code={referral.code} big />
              <span className="text-xs text-muted">Tracking number</span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:text-right">
            <div>
              <dt className="eyebrow">Referring provider</dt>
              <dd className="mt-0.5 font-medium text-ink">{referral.referring_provider_name}</dd>
            </div>
            <div>
              <dt className="eyebrow">Opened</dt>
              <dd className="num mt-0.5 text-[13px] text-ink">{fmtDateTime(referral.referral_date)}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
          <ApptChip state={referral.appointment_state} />
          <DocChip state={referral.document_state} />
          <StaleChip tag={staleTag(referral)} />
        </div>
      </Card>

      {/* 2. Journey */}
      <ReferralJourney referral={referral} history={history} />

      {/* 3. Current mission */}
      <DetailActions referral={referral} isAdmin={isAdmin} />

      {/* 4. Specialist + operational details */}
      <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
        <Card className="p-5 md:p-6">
          <SectionHeading title="Specialist" icon="user" eyebrow="Destination" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <Field label="Specialist" value={referral.specialist_name} />
            <Field label="Specialty" value={referral.specialty} />
            <Field label="Phone" value={referral.specialist_phone} mono />
            <Field label="Fax" value={referral.specialist_fax} mono />
          </dl>
        </Card>

        <Card className="p-5 md:p-6">
          <SectionHeading title="Operational Details" icon="clock" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <Field label="Appointment" value={referral.appointment_slot ? fmtDateTime(referral.appointment_slot) : null} />
            <Field label="Next follow-up" value={referral.next_action_due ? fmtDateTime(referral.next_action_due) : null} />
            <Field label="Last update" value={fmtDateTime(referral.last_action_at)} />
            <Field label="Visit completed" value={referral.completed_at ? fmtDateTime(referral.completed_at) : null} />
            <div>
              <dt className="eyebrow">Attempts</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                <AttemptBadge n={referral.contact_attempts} cap={CAPS.contact} label="Contact attempts" />
                <AttemptBadge n={referral.reschedule_count} cap={CAPS.reschedule} label="Reschedules" />
                <AttemptBadge n={referral.document_attempts} cap={CAPS.document} label="Records chases" />
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* 5–6. Calls & notes | activity timeline */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <Card className="p-5 md:p-6">
            <SectionHeading title="Call Log" icon="phone" />
            <CallLogTable entries={history} />
          </Card>
          <Card className="p-5 md:p-6">
            <SectionHeading title="Notes" icon="note" />
            <NotesSection entries={history} />
          </Card>
        </div>
        <Card className="min-w-0 p-5 md:p-6 lg:col-span-2">
          <SectionHeading title="Activity Timeline" icon="history" />
          <ScanHistory entries={history} />
        </Card>
      </div>

      {/* 7. Admin controls */}
      {isAdmin && (
        <div className="space-y-4 pt-2">
          <AdminTools referral={referral} providers={providers} />
          <DeleteReferral referral={referral} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1 text-ink ${mono ? "num text-[13px]" : ""}`}>{value || "—"}</dd>
    </div>
  );
}
