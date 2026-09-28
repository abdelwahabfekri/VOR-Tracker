import { Card, Skeleton } from "@/components/ui";
import { JourneySkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading referral">
      <Skeleton className="h-4 w-32" />
      <Card className="space-y-3 p-6">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-8 w-36" />
      </Card>
      <JourneySkeleton />
      <Card className="flex items-start gap-4 p-6">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-9 w-80 max-w-full" />
        </div>
      </Card>
    </div>
  );
}
