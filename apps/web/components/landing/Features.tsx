"use client";

import { Activity, Share2, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

const features = [
  {
    icon: Activity,
    title: "Track your usage",
    description:
      "See exactly how much Claude Code you're using. Tokens, cost, models — all in one place.",
  },
  {
    icon: Share2,
    title: "Share your wins",
    description:
      "Post your daily coding sessions. Add screenshots, write about what you built.",
  },
  {
    icon: Trophy,
    title: "Compete on the leaderboard",
    description:
      "See how you stack up globally and regionally. Daily, weekly, monthly rankings.",
  },
];

export function Features() {
  const { ref, inView } = useInView();

  return (
    <section className="bg-white py-24 md:py-32">
      <div ref={ref} className="mx-auto max-w-[1280px] px-6 md:px-8">
        <div className="flex flex-col items-center text-center mb-16">
          <span className="font-[family-name:var(--font-mono)] text-xs tracking-[0.2em] uppercase text-accent mb-4">
            Features
          </span>
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-[-0.03em] leading-tight">
            Everything you need to{" "}
            <span className="text-accent">flex your usage</span>
          </h2>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`group flex flex-col gap-5 rounded-2xl border border-[#E5E5E5] p-8 transition-all duration-500 hover:border-accent/30 hover:shadow-[0_8px_32px_rgba(223,86,31,0.06)] ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{
                transitionDelay: `${i * 120}ms`,
              }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/8 transition-colors group-hover:bg-accent/15">
                <f.icon size={26} className="text-accent" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">{f.title}</h3>
              <p className="text-[1.0625rem] leading-relaxed text-muted">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
