"use client";

import { useRouter } from "next/navigation";
import type { ReferringProvider } from "@/lib/types";

export function ProviderFilter({
  providers,
  active,
  basePath,
}: {
  providers: ReferringProvider[];
  active?: string;
  basePath: string;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted">Provider</label>
      <select
        value={active ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `${basePath}?provider=${v}` : basePath);
        }}
        className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-star"
      >
        <option value="">All providers</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
