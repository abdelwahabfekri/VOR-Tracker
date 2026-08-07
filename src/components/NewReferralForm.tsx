"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReferringProvider } from "@/lib/types";
import { createReferral } from "@/lib/actions";
import { Card, CodeChip } from "@/components/ui";

export function NewReferralForm({ providers }: { providers: ReferringProvider[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    referring_provider_id: providers[0]?.id ?? "",
    specialist_name: "",
    specialty: "",
    specialist_phone: "",
    specialist_fax: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createReferral(form);
      if (!res.ok) { setError(res.error ?? "Could not create referral."); return; }
      setCreated(res.code ?? null);
    });
  }

  if (created) {
    return (
      <Card className="p-7 text-center">
        <div className="text-2xl">✓</div>
        <h2 className="mt-2 text-lg font-semibold text-ink">Referral created</h2>
        <p className="mt-1 text-sm text-muted">Copy this tracking code into the secured Excel sheet.</p>
        <div className="mt-4 flex justify-center">
          <CodeChip code={created} big />
        </div>
        <div className="mt-3 rounded-lg bg-soon-soft px-4 py-2.5 text-sm text-soon">
          Reminder: this app holds no patient identity. The code↔MRN link lives only in the secured Excel sheet.
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => { setCreated(null); setForm({ ...form, specialist_name: "", specialty: "", specialist_phone: "", specialist_fax: "" }); }}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-navy hover:border-star"
          >
            Add another
          </button>
          <button
            onClick={() => router.push(`/tracking/${created}`)}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Open referral
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Referring provider</label>
          <select
            value={form.referring_provider_id}
            onChange={(e) => set("referring_provider_id", e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-star focus:ring-2 focus:ring-star/20"
            required
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Specialist name</label>
            <input
              value={form.specialist_name}
              onChange={(e) => set("specialist_name", e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-star focus:ring-2 focus:ring-star/20"
              placeholder="e.g. Retina Associates"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Specialty</label>
            <input
              value={form.specialty}
              onChange={(e) => set("specialty", e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-star focus:ring-2 focus:ring-star/20"
              placeholder="e.g. Retina"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Specialist phone <span className="text-muted">(optional)</span></label>
            <input
              value={form.specialist_phone}
              onChange={(e) => set("specialist_phone", e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm font-mono outline-none focus:border-star focus:ring-2 focus:ring-star/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Specialist fax <span className="text-muted">(optional)</span></label>
            <input
              value={form.specialist_fax}
              onChange={(e) => set("specialist_fax", e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm font-mono outline-none focus:border-star focus:ring-2 focus:ring-star/20"
            />
          </div>
        </div>

        <div className="rounded-lg bg-canvas px-4 py-3 text-xs text-muted">
          Do not enter any patient name, MRN, or other identifier here. This system stores operational data only.
        </div>

        {error && <div className="rounded-lg bg-overdue-soft px-3 py-2 text-sm text-overdue">{error}</div>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create referral & generate code"}
        </button>
      </form>
    </Card>
  );
}
