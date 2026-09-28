"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { InlineError, Spinner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Those credentials didn't match. Check and try again.");
      setBusy(false);
      return;
    }
    router.push("/tracking");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-login px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/logo-white.png" alt="Aizer" width={150} height={42} priority />
          <div className="mt-4 text-center">
            <div className="text-2xs font-semibold uppercase tracking-[0.2em] text-star-200/80">
              Department of Vision
            </div>
            <div className="mt-0.5 text-xl font-semibold text-white">Referral Tracker</div>
          </div>
        </div>

        <div className="rounded-modal bg-white p-7 shadow-overlay ring-1 ring-white/10">
          <h1 className="text-lg font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Use the account provided by your administrator.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="you@aizerhealth.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="••••••••"
              />
            </div>

            <InlineError>{error}</InlineError>

            <button type="submit" disabled={busy} className="btn btn-primary w-full py-2.5">
              {busy ? <><Spinner className="h-4 w-4" /> Signing in…</> : "Sign in"}
            </button>
          </form>
        </div>

        {/* The app stores patient MRNs, so it must not claim to hold no patient data. */}
        <p className="mt-5 text-center text-xs text-star-200/70">
          Contains patient MRNs (PHI) · Authorized staff only
        </p>
      </div>
    </div>
  );
}
