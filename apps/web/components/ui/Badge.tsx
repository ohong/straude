import { cn } from "@/lib/utils/cn";

type BadgeVariant = "default" | "accent" | "verified" | "rank-1" | "rank-2" | "rank-3" | "rank-top10";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-subtle text-foreground",
  accent: "bg-accent text-white",
  verified: "text-accent",
  "rank-1": "text-white",
  "rank-2": "text-foreground",
  "rank-3": "text-white",
  "rank-top10": "bg-accent text-white",
};

export function Badge({ variant = "default", className, children }: BadgeProps) {
  const isRank = variant.startsWith("rank-");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-xs font-semibold leading-tight",
        variantStyles[variant],
        isRank && variant === "rank-1" && "bg-linear-to-br from-[#FFD700] to-[#FFA500]",
        isRank && variant === "rank-2" && "bg-linear-to-br from-[#E8E8E8] to-[#C0C0C0]",
        isRank && variant === "rank-3" && "bg-linear-to-br from-[#DDA15E] to-[#BC6C25]",
        className,
      )}
    >
      {children}
    </span>
  );
}
