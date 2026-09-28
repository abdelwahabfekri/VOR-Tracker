"use client";

import { useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReferringProvider } from "@/lib/types";
import { Icon } from "@/components/Icon";

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
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-muted">Provider</label>
      <div className="relative">
        <select
          id={id}
          value={active ?? ""}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) params.set("provider", e.target.value);
            else params.delete("provider");
            const qs = params.toString();
            router.push(qs ? `${basePath}?${qs}` : basePath);
          }}
          className="field appearance-none py-2 pr-9"
        >
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}
