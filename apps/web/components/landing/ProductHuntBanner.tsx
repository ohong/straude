"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function ProductHuntBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="relative flex shrink-0 items-center justify-center gap-3 bg-[#da552f] px-10 py-2.5 text-sm text-white sm:gap-4">
      <p className="text-center leading-snug">
        <span className="font-semibold">
          Straude just cracked top 10 on Product Hunt today.
        </span>{" "}
        Please upvote us!{" "}
        <a
          href="https://www.producthunt.com/products/straude?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-straude"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex translate-y-[6px] ml-1"
        >
          <img
            alt="Straude on Product Hunt"
            width="190"
            height="41"
            src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1114059&theme=light&t=1775225231102"
          />
        </a>
      </p>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/80 transition-colors hover:text-white"
        aria-label="Dismiss banner"
      >
        <X size={16} />
      </button>
    </div>
  );
}
