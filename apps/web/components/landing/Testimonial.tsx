"use client";

import { useEffect, useRef, useState } from "react";

export function Testimonial() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-[#F7F5F0] py-24 md:py-32">
      <div
        ref={ref}
        className="mx-auto max-w-[900px] px-6 md:px-8 text-center"
      >
        <blockquote
          className={`transition-all duration-1000 ${
            inView
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold leading-snug tracking-[-0.02em] text-foreground">
            &ldquo;Every moment not spent locked in on Claude Code feels very
            high opportunity cost all of a sudden&rdquo;
          </p>
          <footer className="mt-8 flex items-center justify-center gap-3">
            <img
              src="https://unavatar.io/x/beffjezos"
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="text-left">
              <span className="block text-sm font-bold text-foreground">
                Beff Jezos
              </span>
              <span className="block text-xs text-muted">
                @beffjezos
              </span>
            </div>
          </footer>
        </blockquote>
      </div>
    </section>
  );
}
