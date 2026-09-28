"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReferringProvider } from "@/lib/types";
import { createReferral } from "@/lib/actions";
import { Card, CodeChip, InlineError, Mrn, Spinner } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { isoToNyInput, nyInputToIso } from "@/lib/tz";

const MRN_MAX_LENGTH = 32; // mirrors the mrn_format check in schema.sql

export function NewReferralForm({ providers }: { providers: ReferringProvider[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ code: string; mrn: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    mrn: "",
    referring_provider_id: providers[0]?.id ?? "",
    specialist_name: "",
    specialty: "",
    specialist_phone: "",
    specialist_fax: "",
    referral_date: isoToNyInput(new Date().toISOString()).slice(0, 10),
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createReferral({ ...form, referral_date: nyInputToIso(form.referral_date) });
      if (!res.ok) { setError(res.error ?? "Could not create referral."); return; }
      if (res.code) setCreated({ code: res.code, mrn: form.mrn.trim() });
    });
  }

  if (created) {
    return (
      <SuccessCard
        title="Referral created"
        mrn={created.mrn}
        code={created.code}
        onAnother={() => { setCreated(null); setForm({ ...form, mrn: "", specialist_name: "", specialty: "", specialist_phone: "", specialist_fax: "", referral_date: isoToNyInput(new Date().toISOString()).slice(0, 10) }); }}
        onOpen={() => router.push(`/tracking/${created.code}`)}
      />
    );
  }

  return (
    <Card className="p-6 md:p-7">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="nr-mrn" className="field-label">MRN</label>
          <input
            id="nr-mrn"
            value={form.mrn}
            onChange={(e) => set("mrn", e.target.value)}
            className="field num text-base"
            inputMode="text"
            autoComplete="off"
            maxLength={MRN_MAX_LENGTH}
            required
            aria-describedby="nr-mrn-help"
          />
          <p id="nr-mrn-help" className="field-help">Exactly as in the chart — leading zeros are kept.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="nr-provider" className="field-label">Referring provider</label>
            <select id="nr-provider" value={form.referring_provider_id} onChange={(e) => set("referring_provider_id", e.target.value)} className="field" required>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nr-date" className="field-label">
              Referral opened
            </label>
            <input id="nr-date" type="date" value={form.referral_date} onChange={(e) => set("referral_date", e.target.value)} className="field num" required />
          </div>
        </div>

        <fieldset className="rounded-xl2 border border-line bg-surface-neutral p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Specialist</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nr-sname" className="field-label">Specialist name</label>
              <input id="nr-sname" value={form.specialist_name} onChange={(e) => set("specialist_name", e.target.value)} className="field" placeholder="e.g. Retina Associates" />
            </div>
            <div>
              <label htmlFor="nr-spec" className="field-label">Specialty</label>
              <input id="nr-spec" value={form.specialty} onChange={(e) => set("specialty", e.target.value)} className="field" placeholder="e.g. Retina" />
            </div>
            <div>
              <label htmlFor="nr-phone" className="field-label">Phone <span className="font-normal text-muted">(optional)</span></label>
              <input id="nr-phone" value={form.specialist_phone} onChange={(e) => set("specialist_phone", e.target.value)} className="field num" />
            </div>
            <div>
              <label htmlFor="nr-fax" className="field-label">Fax <span className="font-normal text-muted">(optional)</span></label>
              <input id="nr-fax" value={form.specialist_fax} onChange={(e) => set("specialist_fax", e.target.value)} className="field num" />
            </div>
          </div>
        </fieldset>

        <PrivacyNote />

        <InlineError>{error}</InlineError>

        <button type="submit" disabled={pending} className="btn btn-primary w-full py-3">
          {pending ? <><Spinner className="h-4 w-4" /> Creating…</> : <>Create referral &amp; generate code <Icon name="arrowRight" className="btn-icon h-4 w-4" /></>}
        </button>
      </form>
    </Card>
  );
}

export function PrivacyNote() {
  return (
    <div className="flex items-start gap-2.5 rounded-ctl bg-canvas px-4 py-3 text-xs text-muted ring-1 ring-inset ring-line">
      <Icon name="info" className="mt-px h-4 w-4 text-navy" />
      MRN is the only patient identifier stored here. Do not enter patient names, dates of birth, or clinical details in any field.
    </div>
  );
}

// Success screen shared by New and Existing referral: a calm success glow,
// with the MRN and the new tracking code front and centre.
export function SuccessCard({
  title, mrn, code, onAnother, onOpen,
}: { title: string; mrn: string; code: string; onAnother: () => void; onOpen: () => void }) {
  return (
    <Card tone="done" className="animate-fade-up p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-track-docs text-white shadow-glow-docs">
        <Icon name="check" className="h-7 w-7 animate-check-pop" strokeWidth={2.6} />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-ink">{title}</h2>
      <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3 text-left">
        <div className="rounded-ctl border border-line bg-white px-4 py-3">
          <div className="eyebrow">MRN</div>
          <Mrn value={mrn} className="text-lg" />
        </div>
        <div className="rounded-ctl border border-line bg-white px-4 py-3">
          <div className="eyebrow mb-1">Tracking code</div>
          <CodeChip code={code} />
        </div>
      </div>
      <div className="mt-7 flex justify-center gap-3">
        <button onClick={onAnother} className="btn btn-secondary">Add another</button>
        <button onClick={onOpen} className="btn btn-primary">
          Open referral <Icon name="arrowRight" className="btn-icon h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
