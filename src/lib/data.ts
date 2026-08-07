import { createClient } from "@/lib/supabase/server";
import type { Referral, ReferringProvider, StatusHistoryEntry, AppUser } from "./types";

export async function getMe(): Promise<AppUser | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("app_users").select("*").eq("id", user.id).single();
  return (data as AppUser) ?? null;
}

export async function getProviders(): Promise<ReferringProvider[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("referring_providers")
    .select("*")
    .eq("active", true)
    .order("name");
  return (data as ReferringProvider[]) ?? [];
}

export async function getReferrals(providerId?: string): Promise<Referral[]> {
  const supabase = createClient();
  let q = supabase.from("v_referral_enriched").select("*").order("referral_date", { ascending: false });
  if (providerId) q = q.eq("referring_provider_id", providerId);
  const { data } = await q;
  return (data as Referral[]) ?? [];
}

export async function getReferralByCode(code: string): Promise<Referral | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("v_referral_enriched")
    .select("*")
    .eq("code", code)
    .single();
  return (data as Referral) ?? null;
}

export async function getHistory(referralId: string): Promise<StatusHistoryEntry[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("status_history")
    .select("*")
    .eq("referral_id", referralId)
    .order("changed_at", { ascending: false }); // newest first
  return (data as StatusHistoryEntry[]) ?? [];
}

export async function getDashboard() {
  const supabase = createClient();
  const [{ data: summary }, { data: providerStats }, { data: referrals }] = await Promise.all([
    supabase.from("v_dashboard_summary").select("*").single(),
    supabase.from("v_provider_stats").select("*"),
    supabase.from("v_referral_enriched").select("*"),
  ]);
  return {
    summary: summary ?? null,
    providerStats: providerStats ?? [],
    referrals: (referrals as Referral[]) ?? [],
  };
}
