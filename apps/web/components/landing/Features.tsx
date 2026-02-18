"use client";

import { Activity, Share2, Trophy } from "lucide-react";
import { useInView } from "@/lib/hooks/useInView";

const features = [
  {
    icon: Activity,
    title: "Log your output",
    description:
      "Tokens, cost, models, sessions. Your complete training log for every day you ship.",
  },
  {
    icon: Share2,
    title: "Share your sessions",
    description:
      "Post your daily output to the feed. Show what you shipped, not just what you spent.",
  },
  {
    icon: Trophy,
    title: "Chase the leaderboard",
    description:
      "Daily, weekly, monthly rankings. Global and regional. See where you stand.",
  },
];

export function Features() {
  const { ref, inView } = useInView();

  return (
    <section className="bg-white py-24 md:py-32">
      <div ref={ref} className="mx-auto max-w-[1280px] px-6 md:px-8">
        <div className="flex flex-col items-center text-center mb-16">
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-[-0.03em] leading-tight text-balance">
            Built for the daily grind
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
                <f.icon size={26} className="text-accent" aria-hidden="true" />
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
