"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted">Provider</label>
      <select
        value={active ?? ""}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value) params.set("provider", e.target.value);
          else params.delete("provider");
          const qs = params.toString();
          router.push(qs ? `${basePath}?${qs}` : basePath);
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
