import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/data";
import { signOut } from "@/lib/actions";
import { NavLinks } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");
  const isAdmin = me.role === "admin";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 text-white md:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <Image src="/logo-white.png" alt="Aizer" width={112} height={32} priority />
        </div>
        <div className="px-6 pb-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-star-200/70">
            Department of Vision
          </div>
          <div className="text-sm font-medium text-white/90">Referral Tracker</div>
        </div>

        <NavLinks isAdmin={isAdmin} />

        <div className="mt-auto border-t border-white/10 px-6 py-4">
          <div className="text-sm font-medium">{me.full_name}</div>
          <div className="text-xs text-star-200/70">{isAdmin ? "Administrator" : "Provider — view only"}</div>
          <form action={signOut} className="mt-3">
            <button className="text-xs text-white/70 underline-offset-2 hover:text-white hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between bg-navy-900 px-4 py-3 text-white md:hidden">
          <Image src="/logo-white.png" alt="Aizer" width={92} height={26} />
          <form action={signOut}>
            <button className="text-xs text-white/70">Sign out</button>
          </form>
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-7 md:px-8 md:py-9">
          {children}
        </main>

        <footer className="px-6 py-4 text-center text-xs text-muted">
          Operational tracking only · No patient-identifiable information is stored here
        </footer>
      </div>
    </div>
  );
}
