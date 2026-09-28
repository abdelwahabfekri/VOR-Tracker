import { Card, Skeleton } from "@/components/ui";
import { HeaderSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <HeaderSkeleton />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-4">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-24" />
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-[240px] w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
