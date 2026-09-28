import { HeaderSkeleton, TableSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading referrals">
      <HeaderSkeleton />
      <TableSkeleton />
    </div>
  );
}
