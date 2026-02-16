import { Activity, Share2, Trophy, Flame } from "lucide-react";

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
  {
    icon: Flame,
    title: "Build your streak",
    description:
      "Code with Claude every day. Your streak is your badge of honor.",
  },
];

export function Features() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-8">
        <h2 className="mb-12 text-center text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.02em]">
          Everything you need to flex your usage
        </h2>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F7F5F0]">
                <f.icon size={24} className="text-accent" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
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
