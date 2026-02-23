"use client";

import { Activity, Share2, Trophy } from "lucide-react";
import { motion, type Variants } from "motion/react";

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

const featureCardVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

export function Features() {
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-8">
        <motion.div
          className="flex flex-col items-center text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-[-0.03em] leading-tight text-balance">
            Built for the daily grind
          </h2>
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={featureCardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="group flex flex-col gap-5 rounded-2xl border border-[#E5E5E5] p-8 transition-[border-color,box-shadow] duration-300 hover:border-accent/30 hover:shadow-[0_8px_32px_rgba(223,86,31,0.06)]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/8 transition-colors group-hover:bg-accent/15">
                <f.icon size={26} className="text-accent" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">{f.title}</h3>
              <p className="text-[1.0625rem] leading-relaxed text-muted">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
