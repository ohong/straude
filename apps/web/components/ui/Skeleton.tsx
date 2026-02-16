import { cn } from "@/lib/utils/cn";

interface SkeletonProps {
  className?: string;
  circle?: boolean;
}

export function Skeleton({ className, circle }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-subtle",
        circle ? "rounded-full" : "rounded-[4px]",
        className,
      )}
    />
  );
}
