import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background px-4 sm:px-6">
        <Skeleton className="h-5 w-28" />
      </header>

      {/* Profile header */}
      <div className="border-b border-border px-4 py-5 sm:p-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
            {/* Bio */}
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            {/* Follow counts */}
            <div className="flex gap-6">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Contribution graph placeholder */}
      <div className="border-b border-border px-4 py-5 sm:p-6">
        <Skeleton className="mb-3 h-3 w-24" />
        <Skeleton className="h-32 w-full" />
      </div>

      {/* Posts section */}
      <div>
        <div className="border-b border-border px-4 py-3 sm:px-6">
          <Skeleton className="h-3 w-28" />
        </div>

        {/* 2 card placeholders */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border-b border-border px-4 py-5 sm:p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="mt-4 h-5 w-3/4" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
            <div className="mt-4 grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
