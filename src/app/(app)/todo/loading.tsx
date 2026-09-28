import { HeaderSkeleton, CardsSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading to-do">
      <HeaderSkeleton />
      <CardsSkeleton />
    </div>
  );
}
