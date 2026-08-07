"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const links = [
    ...(isAdmin ? [{ href: "/todo", label: "To-Do", icon: "◔" }] : []),
    { href: "/tracking", label: "Tracking", icon: "◈" },
    { href: "/dashboard", label: "Dashboard", icon: "▤" },
    ...(isAdmin ? [{ href: "/new", label: "New referral", icon: "＋" }] : []),
  ];
  return (
    <nav className="flex flex-col gap-1 px-3">
      {links.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="w-4 text-center text-star-400">{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
