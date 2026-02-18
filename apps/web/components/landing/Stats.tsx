"use client";

import { useEffect, useRef, useState, useCallback } from "react";

function StatCard({
  value,
  suffix,
  label,
  isDecimal,
}: {
  value: number;
  suffix: string;
  label: string;
  isDecimal?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState("0");
  const hasStarted = useRef(false);

  const animate = useCallback(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const target = isDecimal ? value * 10 : value;
    const duration = 2000;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      if (isDecimal) {
        setDisplay((current / 10).toFixed(1));
      } else {
        setDisplay(String(current));
      }

      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [value, isDecimal]);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) animate();
      },
      { threshold: 0.3 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [animate]);

  return (
    <div
      ref={ref}
      className="flex flex-col items-center rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-8 text-center transition-shadow hover:shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
    >
      <span className="font-[family-name:var(--font-mono)] text-[clamp(2.5rem,5vw,4rem)] font-bold leading-none tracking-tighter text-foreground">
        {display}
        <span className="text-accent">{suffix}</span>
      </span>
      <span className="mt-3 text-sm text-muted">{label}</span>
    </div>
  );
}

const stats = [
  {
    value: 847,
    suffix: "",
    label: "developers logging daily",
  },
  {
    value: 2.4,
    suffix: "M",
    label: "tokens tracked this week",
    isDecimal: true,
  },
  {
    value: 142,
    suffix: "",
    label: "countries represented",
  },
];

export function Stats() {
  return (
    <section className="bg-white py-20 md:py-24">
      <div className="mx-auto max-w-[1280px] px-6 md:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}
