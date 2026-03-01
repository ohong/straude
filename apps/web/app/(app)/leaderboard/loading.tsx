import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      {/* Period tabs */}
      <div className="flex justify-center border-b border-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-3 sm:px-5">
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        {/* Table header */}
        <div className="grid grid-cols-5 border-b border-border px-6 py-3">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="ml-auto h-3 w-10" />
          <Skeleton className="ml-auto h-3 w-12" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>

        {/* 10 row placeholders */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 items-center border-b border-border px-6 py-3">
            <Skeleton className="h-5 w-8" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="ml-auto h-4 w-10" />
          </div>
        ))}
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-1 text-right">
              <Skeleton className="ml-auto h-4 w-14" />
              <Skeleton className="ml-auto h-3 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
