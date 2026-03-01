import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { getInitials } from "@/lib/utils/format";

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

export function Avatar({ src, alt = "", size = "md", fallback, className }: AvatarProps) {
  const { px, text } = sizeMap[size];
  const initials = fallback ? getInitials(fallback) : "?";

  if (src) {
    const isSvg = src.includes("/svg") || src.endsWith(".svg");
    const imgClass = cn("rounded-full object-cover shrink-0", className);
    const imgStyle = { width: px, height: px };

    // SVGs break under Next.js Image optimization — use plain <img>
    if (isSvg) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={px} height={px} className={imgClass} style={imgStyle} />
      );
    }

    return (
      <Image
        src={src}
        alt={alt}
        width={px}
        height={px}
        className={imgClass}
        style={imgStyle}
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
