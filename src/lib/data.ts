import { createClient } from "@/lib/supabase/server";
import type { Referral, ReferringProvider, StatusHistoryEntry, AppUser } from "./types";

// A failed query must never look like "no data" — an empty list would make
// referrals appear to vanish. Log a safe summary (code + message, never row
// contents) and throw; the (app)/error.tsx boundary shows a retry screen.
function fail(context: string, error: { code?: string; message: string }): never {
  console.error(`[data] ${context} failed`, error.code ?? "", error.message);
  throw new Error(`Could not load ${context}.`);
}

export async function getMe(): Promise<AppUser | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("app_users").select("*").eq("id", user.id).maybeSingle();
  if (error) fail("your account", error);
  return (data as AppUser) ?? null;
}

export async function getProviders(): Promise<ReferringProvider[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("referring_providers")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) fail("providers", error);
  return (data as ReferringProvider[]) ?? [];
}

export async function getReferrals(providerId?: string): Promise<Referral[]> {
  const supabase = createClient();
  let q = supabase.from("v_referral_enriched").select("*").order("referral_date", { ascending: false });
  if (providerId) q = q.eq("referring_provider_id", providerId);
  const { data, error } = await q;
  if (error) fail("referrals", error);
  return (data as Referral[]) ?? [];
}

// null = no such referral, or RLS hides it (both render as not found).
export async function getReferralByCode(code: string): Promise<Referral | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_referral_enriched")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) fail("the referral", error);
  return (data as Referral) ?? null;
}

export async function getHistory(referralId: string): Promise<StatusHistoryEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("status_history")
    .select("*")
    .eq("referral_id", referralId)
    .order("changed_at", { ascending: false }); // newest first
  if (error) fail("referral history", error);
  return (data as StatusHistoryEntry[]) ?? [];
}

// History for many referrals at once (weekly report), oldest first.
export async function getHistoryForReferrals(referralIds: string[]): Promise<StatusHistoryEntry[]> {
  const supabase = createClient();
  const out: StatusHistoryEntry[] = [];
  // Chunked: ids travel in the URL, which has a length limit.
  for (let i = 0; i < referralIds.length; i += 100) {
    const { data, error } = await supabase
      .from("status_history")
      .select("*")
      .in("referral_id", referralIds.slice(i, i + 100))
      .order("changed_at", { ascending: true });
    if (error) fail("referral history", error);
    out.push(...((data as StatusHistoryEntry[]) ?? []));
  }
  return out.sort((a, b) => a.changed_at.localeCompare(b.changed_at));
}

export async function getDashboard(): Promise<{ referrals: Referral[] }> {
  const supabase = createClient();
  const { data, error } = await supabase.from("v_referral_enriched").select("*");
  if (error) fail("dashboard data", error);
  return { referrals: (data as Referral[]) ?? [] };
}
