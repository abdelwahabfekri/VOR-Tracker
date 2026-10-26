"use client";

import { useState } from "react";
import type { SavedSpecialist } from "@/lib/types";

// Specialist block shared by New referral, Add existing referral and Edit
// details. A saved specialist (from earlier referrals) fills every field in
// one pick; the fields stay editable, so a changed fax can be fixed in place.

export const SPECIALTIES = ["Ophthalmology", "Ophthalmology-Cataract", "Neurology", "Neuro-Ophthalmology"] as const;
const OTHER = "__other__";

export type SpecialistValue = SavedSpecialist;
type Field = keyof SpecialistValue;

export function SpecialistFields({
  idPrefix,
  value,
  onChange,
  saved,
  optionalLabel = true,
}: {
  idPrefix: string;
  value: SpecialistValue;
  onChange: (next: SpecialistValue) => void;
  saved: SavedSpecialist[];
  optionalLabel?: boolean;
}) {
  const set = (k: Field, v: string) => onChange({ ...value, [k]: v });
  const savedIndex = saved.findIndex(
    (s) =>
      s.specialist_name.toLowerCase() === value.specialist_name.trim().toLowerCase() &&
      s.specialty.toLowerCase() === value.specialty.trim().toLowerCase()
  );
  const opt = optionalLabel ? <span className="font-normal text-muted">(optional)</span> : null;

  function pick(v: string) {
    if (v === "") onChange({ specialist_name: "", specialty: "", specialist_phone: "", specialist_fax: "" });
    else onChange({ ...saved[Number(v)] });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {saved.length > 0 && (
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-saved`} className="field-label">Saved specialist</label>
          <select id={`${idPrefix}-saved`} className="field" value={savedIndex >= 0 ? String(savedIndex) : ""} onChange={(e) => pick(e.target.value)}>
            <option value="">New specialist — enter below</option>
            {saved.map((s, i) => (
              <option key={`${s.specialist_name}|${s.specialty}`} value={i}>
                {s.specialty ? `${s.specialist_name} · ${s.specialty}` : s.specialist_name}
              </option>
            ))}
          </select>
          <p className="field-help">Picks up the name, specialty, phone and fax from earlier referrals.</p>
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-name`} className="field-label">Specialist name</label>
        <input id={`${idPrefix}-name`} className="field" value={value.specialist_name} onChange={(e) => set("specialist_name", e.target.value)} placeholder="e.g. Retina Associates" />
      </div>
      <SpecialtyField id={`${idPrefix}-spec`} value={value.specialty} onChange={(v) => set("specialty", v)} />
      <div>
        <label htmlFor={`${idPrefix}-phone`} className="field-label">Phone {opt}</label>
        <input id={`${idPrefix}-phone`} className="field num" value={value.specialist_phone} onChange={(e) => set("specialist_phone", e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-fax`} className="field-label">Fax {opt}</label>
        <input id={`${idPrefix}-fax`} className="field num" value={value.specialist_fax} onChange={(e) => set("specialist_fax", e.target.value)} />
      </div>
    </div>
  );
}

// Fixed list plus "Other", which asks for the specialty as text. A stored
// value outside the list (older referrals) opens as Other with its text.
function SpecialtyField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const listed = (SPECIALTIES as readonly string[]).includes(value);
  const [otherPicked, setOtherPicked] = useState(false);
  const isOther = !listed && (otherPicked || value !== "");

  return (
    <div>
      <label htmlFor={id} className="field-label">Specialty</label>
      <select
        id={id}
        className="field"
        value={listed ? value : isOther ? OTHER : ""}
        onChange={(e) => {
          const v = e.target.value;
          setOtherPicked(v === OTHER);
          onChange(v === OTHER ? "" : v);
        }}
      >
        <option value="">Choose…</option>
        {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
        <option value={OTHER}>Other…</option>
      </select>
      {isOther && (
        <input
          id={`${id}-other`}
          aria-label="Other specialty"
          className="field mt-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type the specialty"
          required
          autoFocus={otherPicked}
        />
      )}
    </div>
  );
}
