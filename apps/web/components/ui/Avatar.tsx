import { cn } from "@/lib/utils/cn";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: AvatarSize;
  fallback?: string;
  className?: string;
}

const sizeMap: Record<AvatarSize, { px: number; text: string }> = {
  xs: { px: 24, text: "text-[10px]" },
  sm: { px: 32, text: "text-xs" },
  md: { px: 40, text: "text-sm" },
  lg: { px: 80, text: "text-xl" },
  xl: { px: 120, text: "text-3xl" },
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ src, alt = "", size = "md", fallback, className }: AvatarProps) {
  const { px, text } = sizeMap[size];
  const initials = fallback ? getInitials(fallback) : "?";

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        width={px}
        height={px}
        className={cn(
          "rounded-full object-cover shrink-0",
          className,
        )}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-subtle text-muted flex items-center justify-center shrink-0 font-medium select-none",
        text,
        className,
      )}
      style={{ width: px, height: px }}
      aria-label={alt}
    >
      {initials}
    </div>
  );
}
