"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

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
    <div className="flex min-h-screen items-center justify-center bg-navy-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/logo-white.png" alt="Aizer" width={150} height={42} priority />
          <div className="mt-4 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-star-200/70">
              Department of Vision
            </div>
            <div className="text-lg font-semibold text-white">Referral Tracker</div>
          </div>
        </div>

        <div className="rounded-xl2 bg-white p-7 shadow-pop">
          <h1 className="text-lg font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Use the account provided by your administrator.</p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-star focus:ring-2 focus:ring-star/20"
                placeholder="you@aizerhealth.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-star focus:ring-2 focus:ring-star/20"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-overdue-soft px-3 py-2 text-sm text-overdue">{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-star-200/60">
          Operational data only · No patient information is stored in this system
        </p>
      </div>
    </div>
  );
}
