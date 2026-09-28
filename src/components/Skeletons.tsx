import { Card, Skeleton } from "@/components/ui";

// Loading placeholders shaped like the content they stand in for.
export function HeaderSkeleton() {
  return (
    <div className="mb-7 space-y-2">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      <Card className="mb-5 flex items-center gap-4 p-3">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="ml-auto h-9 w-64" />
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-table-head px-4 py-3"><Skeleton className="h-3 w-2/3" /></div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-line/70 px-4 py-4 last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="hidden h-4 w-32 md:block" />
            <Skeleton className="ml-auto h-6 w-32" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export function JourneySkeleton() {
  return (
    <Card className="p-6">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-2 h-5 w-44" />
      <Skeleton className="mt-3 h-1.5 w-64" />
      <div className="mt-8 hidden items-start gap-2 lg:flex">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-4 lg:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-2xl" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CardsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <Card key={i} className="flex items-start gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-80 max-w-full" />
            <Skeleton className="h-8 w-72 max-w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}
