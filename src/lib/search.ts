"use server";

import { createClient } from "@/lib/supabase/server";
import { APPT_LABEL, DOC_LABEL, MIN_MRN_SEARCH, isActive } from "./types";
import type { Referral } from "./types";

// Global MRN search. A server action (POST body), so the MRN never lands in a
// URL, browser history, referrer or access log. Runs as the signed-in user —
// RLS decides which referrals come back. The search term is never logged.

const LIMIT = 25;

export interface MrnHit {
  code: string;
  mrn: string;
  provider: string;
  specialist: string;
  status: string;
  active: boolean;
  openDate: string;
  exact: boolean;
}

export type MrnSearchResult =
  | { ok: true; hits: MrnHit[]; truncated: boolean }
  | { ok: false; error: string };

// Trim and collapse inner whitespace. Never cast to a number: leading zeros
// are part of the MRN.
function normalize(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

// LIKE wildcards in user input are literal characters.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// submitted: the user pressed Enter, so search even a short MRN (MRNs can be
// 1–2 characters); while typing, wait for MIN_MRN_SEARCH characters.
export async function searchByMrn(raw: string, submitted = false): Promise<MrnSearchResult> {
  const term = normalize(typeof raw === "string" ? raw : "");
  if (term.length < (submitted ? 1 : MIN_MRN_SEARCH) || term.length > 32) return { ok: true, hits: [], truncated: false };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has ended. Sign in again." };

  // Prefix match; exact matches are sorted to the top below.
  const { data, error } = await supabase
    .from("v_referral_enriched")
    .select("*")
    .ilike("mrn", `${escapeLike(term)}%`)
    .order("referral_date", { ascending: false })
    .limit(LIMIT + 1);

  if (error) {
    console.error("[search] mrn search failed", error.code ?? "");
    return { ok: false, error: "Search is unavailable right now." };
  }

  const rows = (data as Referral[]) ?? [];
  const needle = term.toLowerCase();
  const hits = rows.slice(0, LIMIT).map((r): MrnHit => ({
    code: r.code,
    mrn: r.mrn,
    provider: r.referring_provider_name ?? "—",
    specialist: r.specialist_name || "—",
    status:
      r.appointment_state === "appointment_completed" && r.document_state !== "awaiting_appointment"
        ? DOC_LABEL[r.document_state]
        : APPT_LABEL[r.appointment_state],
    active: isActive(r),
    openDate: r.referral_date,
    exact: r.mrn.toLowerCase() === needle,
  }));
  // exact first; otherwise keep newest-first
  hits.sort((a, b) => Number(b.exact) - Number(a.exact));
  return { ok: true, hits, truncated: rows.length > LIMIT };
}
