"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions";

export function TopNav({
  isAdmin,
  userName,
  userRole,
}: {
  isAdmin: boolean;
  userName: string;
  userRole: string;
}) {
  const path = usePathname();
  const links = [
    ...(isAdmin ? [{ href: "/todo", label: "To-Do", icon: "◔" }] : []),
    { href: "/tracking", label: "Tracking", icon: "◈" },
    { href: "/dashboard", label: "Dashboard", icon: "▤" },
  ];

  const initials = userName
    .split(/[ ,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-40 bg-navy-900 text-white shadow-pop">
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 md:px-8">
        {/* Left: nav links */}
        <nav className="flex items-center gap-1 overflow-x-auto">
          {links.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-3 ${
                  active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-lg leading-none text-star-400">{l.icon}</span>
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Center: logo */}
        <Link href="/tracking" className="justify-self-center">
          <Image src="/logo-white.png" alt="Aizer" width={108} height={30} priority />
        </Link>

        {/* Right: new referral (admin) + user */}
        <div className="flex items-center justify-end gap-2 sm:gap-3">
          {isAdmin && (
            <Link
              href="/new"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-turquoise px-3 py-2 text-sm font-semibold text-navy-900 shadow-sm transition hover:bg-turquoise-hover sm:px-3.5"
            >
              <span className="text-base leading-none">＋</span>
              <span className="hidden sm:inline">New referral</span>
            </Link>
          )}

          <div className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-1.5 sm:pr-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-star-400 text-xs font-bold text-navy-900">
              {initials || "?"}
            </span>
            <div className="hidden leading-tight md:block">
              <div className="text-xs font-semibold text-white">{userName}</div>
              <div className="text-[10px] text-star-200/70">{userRole}</div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                className="ml-0.5 rounded-md px-1.5 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
