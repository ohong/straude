import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background px-4 sm:px-6">
        <Skeleton className="h-5 w-12" />
      </header>

      {/* Single card placeholder */}
      <div className="border-b border-border px-4 py-5 sm:p-6">
        {/* Header: avatar + text */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Title */}
        <Skeleton className="mt-4 h-6 w-3/4" />

        {/* Description lines */}
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />

        {/* Stats grid */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>

        {/* Action bar */}
        <div className="mt-4 flex gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>

      {/* Comment section */}
      <div className="border-t border-border">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-4">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
