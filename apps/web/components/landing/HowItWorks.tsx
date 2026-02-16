import { Terminal, Rss, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: Terminal,
    step: "01",
    title: "Install & push",
    code: "npx straude@latest push",
    description: "One command. No install needed.",
  },
  {
    icon: Rss,
    step: "02",
    title: "Your post goes live",
    code: null,
    description: "Usage stats are automatically shared with your followers.",
  },
  {
    icon: TrendingUp,
    step: "03",
    title: "Climb the ranks",
    code: null,
    description: "Track your streak, compete on the leaderboard, get kudos.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-black py-20 text-white md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-8">
        <h2 className="mb-16 text-center text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.02em]">
          How it works
        </h2>

        <div className="grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <div key={s.step} className="flex flex-col items-center text-center md:items-start md:text-left">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <s.icon size={28} className="text-accent" />
              </div>
              <span className="mt-6 font-mono text-xs tracking-widest text-accent">
                STEP {s.step}
              </span>
              <h3 className="mt-2 text-xl font-semibold">{s.title}</h3>
              {s.code && (
                <code className="mt-3 inline-block rounded-lg bg-white/10 px-4 py-2 font-mono text-sm text-white/90">
                  {s.code}
                </code>
              )}
              <p className="mt-3 text-base leading-relaxed text-white/60">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
