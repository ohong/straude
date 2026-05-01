"use client";

import Image from "next/image";
import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type TeamBadgeSize = "sm" | "md";

interface TeamBadgeProps {
  url: string | null | undefined;
  faviconUrl: string | null | undefined;
  size?: TeamBadgeSize;
  className?: string;
}

const SIZE_PX: Record<TeamBadgeSize, number> = {
  sm: 14,
  md: 18,
};

function deriveHostname(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function TeamBadge({
  url,
  faviconUrl,
  size = "sm",
  className,
}: TeamBadgeProps) {
  const [errored, setErrored] = useState(false);

  if (!url) return null;
  const host = deriveHostname(url);
  if (!host) return null;

  const px = SIZE_PX[size];
  const altText = `${host} logo`;
  const wrapperClass = cn(
    "inline-flex shrink-0 items-center align-text-bottom",
    className,
  );
  const showFavicon = faviconUrl && !errored;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={host}
      aria-label={`Team: ${host}`}
      className={wrapperClass}
      style={{ width: px, height: px }}
      onClick={(e) => e.stopPropagation()}
    >
      {showFavicon ? (
        <Image
          src={faviconUrl}
          alt={altText}
          width={px}
          height={px}
          onError={() => setErrored(true)}
          style={{ width: px, height: px, borderRadius: 3 }}
        />
      ) : (
        <Building2
          aria-label={altText}
          size={px}
          strokeWidth={1.75}
          className="text-muted"
        />
      )}
    </a>
  );
}
