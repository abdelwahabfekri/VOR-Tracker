import { redirect } from "next/navigation";
import { getMe } from "@/lib/data";
import { TopNav } from "@/components/NavLinks";
import { Toaster } from "@/components/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");
  const isAdmin = me.role === "admin";

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        isAdmin={isAdmin}
        userName={me.full_name}
        userRole={isAdmin ? "Administrator" : "Provider — view only"}
      />

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-6 md:px-8 md:py-9">
        {children}
      </main>

      <footer className="px-6 py-5 text-center text-xs text-muted">
        Operational tracking · MRN is the only patient identifier stored here
      </footer>
      <Toaster />
    </div>
  );
}
