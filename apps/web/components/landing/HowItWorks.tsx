"use client";

import { useInView } from "@/lib/hooks/useInView";

const steps = [
  {
    step: "1",
    title: "Log your session",
    code: "bunx straude",
    description:
      "One command. No install required. Scans your local Claude Code usage and posts it to your profile.",
  },
  {
    step: "2",
    title: "Your post goes live",
    code: null,
    description:
      "Usage stats, cost, models, and session count — automatically shared with your followers.",
  },
  {
    step: "3",
    title: "Climb the ranks",
    code: null,
    description:
      "Track your streak, compete on global and regional leaderboards, get kudos from the community.",
  },
];

export function HowItWorks() {
  const { ref, inView } = useInView(0.15);

  return (
    <section className="bg-[#0A0A0A] py-24 text-white md:py-32 relative overflow-hidden">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(223,86,31,0.05) 0%, transparent 70%)",
        }}
      />

      <div ref={ref} className="relative z-10 mx-auto max-w-[1280px] px-6 md:px-8">
        <div className="flex flex-col items-center text-center mb-16">
          <span className="font-[family-name:var(--font-mono)] text-xs tracking-[0.2em] uppercase text-accent mb-4">
            How it works
          </span>
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-[-0.03em] text-balance">
            Three steps. Zero friction.
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.step}
              className={`flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-8 transition-all duration-600 hover:border-accent/30 hover:bg-white/[0.05] ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              {/* Step number */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
                {s.step}
              </div>

              <h3 className="mt-6 text-xl font-bold tracking-tight">
                {s.title}
              </h3>

              {s.code && (
                <code className="mt-4 inline-block self-start rounded-lg bg-white/10 px-4 py-2.5 font-[family-name:var(--font-mono)] text-sm text-white/80">
                  {s.code}
                </code>
              )}

              <p className="mt-4 text-base leading-relaxed text-white/50">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
