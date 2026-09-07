import { Skeleton } from "@/components/ui/Skeleton";

export function RouteLoading({
  label,
  rows = 3,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <section role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading {label}</span>
      <div aria-hidden="true">
        <header className="flex h-14 items-center border-b border-border px-[var(--app-page-padding-x)]">
          <Skeleton className="h-5 w-28" />
        </header>
        <div className="space-y-5 px-[var(--app-page-padding-x)] py-6">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="space-y-3 border-b border-border pb-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
