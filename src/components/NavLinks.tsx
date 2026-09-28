"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/actions";
import { searchByMrn, type MrnHit } from "@/lib/search";
import { MIN_MRN_SEARCH } from "@/lib/types";
import { Icon, type IconName } from "@/components/Icon";
import { Spinner } from "@/components/ui";
import { fmtDate } from "@/lib/tz";

type NavLink = { href: string; label: string; icon: IconName };

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
  const [menuOpen, setMenuOpen] = useState(false);

  // close the mobile menu on navigation
  useEffect(() => setMenuOpen(false), [path]);

  const links: NavLink[] = [
    ...(isAdmin ? [{ href: "/todo", label: "To-Do", icon: "todo" as const }] : []),
    { href: "/tracking", label: "Tracking", icon: "route" },
    { href: "/dashboard", label: "Dashboard", icon: "chart" },
    ...(isAdmin ? [{ href: "/reports/weekly", label: "Weekly Reports", icon: "mail" as const }] : []),
  ];
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 bg-nav text-white shadow-overlay">
      <div className="pointer-events-none absolute inset-0 bg-nav-glow" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-x-4 xl:flex-nowrap gap-y-3 px-4 py-3 md:px-8">
        {/* Left: logo + nav links */}
        <Link href="/tracking" className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:shadow-glow-star">
          <Image src="/logo-white.png" alt="Aizer — Referral Tracker" width={92} height={26} priority />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition duration-fast focus-visible:outline-none focus-visible:shadow-glow-star ${
                isActive(l.href)
                  ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10),inset_0_0_16px_rgba(47,164,231,0.28)]"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon name={l.icon} className={`h-4 w-4 ${isActive(l.href) ? "text-star-light" : "text-star-400/80"}`} />
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Center: MRN search (full-width row on small screens) */}
        <div className="order-last w-full xl:order-none xl:ml-2 xl:w-auto xl:min-w-[200px] xl:max-w-sm xl:flex-1">
          <MrnSearch />
        </div>

        {/* Right: new referral (admin) + user */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isAdmin && <NewReferralMenu />}
          <UserMenu userName={userName} userRole={userRole} isAdmin={isAdmin} />
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white xl:hidden"
          >
            <Icon name={menuOpen ? "x" : "menu"} className="h-5 w-5" />
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>

        {menuOpen && (
          <nav id="mobile-nav" aria-label="Main" className="w-full animate-fade-in xl:hidden">
            <div className="grid gap-1 rounded-2xl bg-white/5 p-1.5 sm:grid-cols-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                    isActive(l.href) ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5"
                  }`}
                >
                  <Icon name={l.icon} className="h-4 w-4 text-star-400" />
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// New referral — one button, two choices: a brand-new referral, or one that
// is already in progress (entered at its current stage).
// ---------------------------------------------------------------------------
function NewReferralMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none";

  return (
    <div ref={box} className="relative">
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn btn-star rounded-full px-3 sm:px-3.5"
      >
        <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
        <span className="hidden sm:inline">New Referral</span>
        <span className="sr-only sm:hidden">New Referral</span>
        <Icon name="chevronDown" className={`hidden h-3.5 w-3.5 transition-transform duration-fast sm:block ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-72 animate-fade-up rounded-2xl border border-line bg-white p-2 text-ink shadow-overlay">
          <Link href="/new" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-star/10 text-star"><Icon name="plus" className="h-4 w-4" strokeWidth={2.2} /></span>
            <span>
              <span className="block text-sm font-semibold">New Referral</span>
              <span className="block text-xs text-muted">Start tracking and generate a VOR code</span>
            </span>
          </Link>
          <Link href="/new/existing" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy"><Icon name="history" className="h-4 w-4" /></span>
            <span>
              <span className="block text-sm font-semibold">Existing Referral</span>
              <span className="block text-xs text-muted">Already in progress — add it at its current stage</span>
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// User menu — a popover instead of name + sign-out crowding the bar.
// ---------------------------------------------------------------------------
function UserMenu({ userName, userRole, isAdmin }: { userName: string; userRole: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const initials = userName.split(/[ ,]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  return (
    <div ref={box} className="relative">
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-white/5 p-1 pr-1 transition duration-fast hover:bg-white/10 focus-visible:outline-none focus-visible:shadow-glow-star md:pr-2.5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-star-light to-star-400 text-xs font-bold text-navy-900">
          {initials || "?"}
        </span>
        <span className="hidden max-w-[140px] truncate text-xs font-semibold text-white md:block">{userName}</span>
        <Icon name="chevronDown" className="hidden h-3.5 w-3.5 text-white/60 md:block" />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 animate-fade-up rounded-2xl border border-line bg-white p-2 text-ink shadow-overlay">
          <div className="px-3 py-2.5">
            <div className="truncate text-sm font-semibold">{userName}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${isAdmin ? "bg-star" : "bg-muted"}`} />
              {userRole}
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <form action={signOut}>
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink hover:bg-canvas">
              <Icon name="logout" className="h-4 w-4 text-muted" />
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Global MRN search.
//   * "VOR-1234567" opens that referral directly.
//   * Anything else is an MRN: results come from a server action, so the MRN
//     never appears in a URL or browser history. Nothing is stored — no
//     recent searches, no localStorage, and the input clears after opening.
// ---------------------------------------------------------------------------
const VOR_RE = /^vor-\d{7}$/i;

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; hits: MrnHit[]; truncated: boolean }
  | { kind: "error"; message: string };

function MrnSearch() {
  const router = useRouter();
  const inputId = useId();
  const listId = useId();
  const [q, setQ] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const term = q.trim().replace(/\s+/g, " ");
  const isVor = VOR_RE.test(term);

  async function run(value: string, submitted: boolean) {
    const my = ++seq.current;
    setState({ kind: "loading" });
    try {
      const res = await searchByMrn(value, submitted);
      if (my !== seq.current) return; // a newer keystroke won
      setState(res.ok ? { kind: "done", hits: res.hits, truncated: res.truncated } : { kind: "error", message: res.error });
    } catch {
      if (my !== seq.current) return;
      setState({ kind: "error", message: "Search is unavailable right now." });
    }
    setActive(-1);
  }

  // Debounced search while typing.
  useEffect(() => {
    if (isVor || term.length < MIN_MRN_SEARCH) {
      seq.current++;
      setState({ kind: "idle" });
      setActive(-1);
      return;
    }
    const t = setTimeout(() => run(term, false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, isVor]);

  // Click outside closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function reset() {
    seq.current++;
    setQ("");
    setState({ kind: "idle" });
    setActive(-1);
    setOpen(false);
  }

  function openCode(code: string) {
    reset();
    input.current?.blur();
    router.push(`/tracking/${code.toUpperCase()}`);
  }

  const hits = state.kind === "done" ? state.hits : [];

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open && term) { setOpen(false); } else { reset(); }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!hits.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => {
        if (e.key === "ArrowDown") return i + 1 >= hits.length ? 0 : i + 1;
        return i <= 0 ? hits.length - 1 : i - 1;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!term) return;
      if (isVor) return openCode(term);
      if (active >= 0 && hits[active]) return openCode(hits[active].code);
      // One match: open it. Several: keep the list open so the user picks —
      // never open one of them at random.
      if (state.kind === "done" && hits.length === 1) return openCode(hits[0].code);
      setOpen(true);
      if (state.kind !== "done" || term.length < MIN_MRN_SEARCH) run(term, true);
    }
  }

  const showPanel = open && term.length > 0 && (isVor || state.kind !== "idle" || term.length < MIN_MRN_SEARCH);
  const activeId = active >= 0 ? `${listId}-opt-${active}` : undefined;

  return (
    <div ref={box} className="relative">
      <label htmlFor={inputId} className="sr-only">Search referrals by MRN</label>
      <div className="glass flex items-center gap-2 rounded-full px-3.5 py-2 text-white/70 transition duration-fast focus-within:border-star/60 focus-within:bg-white/15 focus-within:shadow-glow-star">
        <Icon name="search" className="h-4 w-4" />
        <input
          ref={input}
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search by MRN…"
          // no browser form history for PHI
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={40}
          className="w-full bg-transparent text-sm text-white placeholder:text-white/55 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {state.kind === "loading" ? (
          <Spinner className="h-4 w-4 text-star-light" />
        ) : q ? (
          <button type="button" onClick={() => { reset(); input.current?.focus(); }} className="rounded-full p-0.5 text-white/60 hover:text-white" aria-label="Clear search">
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 min-w-[min(100%,360px)] animate-fade-up overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-overlay xl:w-[440px]">
          {isVor ? (
            <button
              type="button"
              onClick={() => openCode(term)}
              className="flex w-full items-center gap-3 bg-star/5 px-4 py-3 text-left text-sm hover:bg-star/10"
            >
              <Icon name="arrowRight" className="h-4 w-4 text-star" />
              <span>Open <span className="num font-semibold text-navy">{term.toUpperCase()}</span></span>
              <kbd className="ml-auto rounded border border-line px-1.5 text-2xs text-muted">Enter</kbd>
            </button>
          ) : term.length < MIN_MRN_SEARCH && state.kind === "idle" ? (
            <p className="px-4 py-3 text-sm text-muted">Keep typing the MRN, or press Enter to search.</p>
          ) : state.kind === "loading" ? (
            <div className="space-y-2 p-4" aria-live="polite">
              <span className="sr-only">Searching…</span>
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ) : state.kind === "error" ? (
            <div role="alert" className="flex items-start gap-3 bg-overdue-soft/60 px-4 py-3 text-sm">
              <Icon name="alert" className="mt-0.5 h-4 w-4 text-overdue" />
              <div>
                <div className="font-semibold text-overdue">{state.message}</div>
                <button type="button" onClick={() => run(term, true)} className="mt-1 text-xs font-semibold text-navy underline-offset-2 hover:underline">
                  Try Again
                </button>
              </div>
            </div>
          ) : hits.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-4 text-sm text-muted" aria-live="polite">
              <Icon name="search" className="h-4 w-4" />
              No referrals found for this MRN.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-line bg-table-head px-4 py-2" aria-live="polite">
                <span className="eyebrow">{hits.length} referral{hits.length === 1 ? "" : "s"} found{state.kind === "done" && state.truncated ? " (first 25)" : ""}</span>
                <span className="hidden text-2xs text-muted sm:inline">↑ ↓ to move · Enter to open</span>
              </div>
              <ul id={listId} role="listbox" aria-label="MRN search results" className="max-h-[60vh] overflow-y-auto py-1">
                {hits.map((h, i) => (
                  <li
                    key={h.code}
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => openCode(h.code)}
                    className={`mx-1 cursor-pointer rounded-xl px-3 py-2.5 transition duration-fast ${
                      i === active ? "bg-star/10 shadow-[inset_3px_0_0_#2FA4E7]" : "hover:bg-canvas"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="num text-sm font-semibold text-ink">{h.mrn}</span>
                      {h.exact && <span className="rounded-full bg-star/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-star">Exact</span>}
                      <span className="num ml-auto text-xs font-semibold text-navy">{h.code}</span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-muted">
                      <span className="truncate">{h.provider}</span>
                      <span className="truncate text-right">{h.specialist}</span>
                      <span className={`truncate ${h.active ? "text-appt" : "text-muted"}`}>{h.status}</span>
                      <span className="text-right">Opened {fmtDate(h.openDate)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
