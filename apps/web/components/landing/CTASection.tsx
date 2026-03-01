"use client";

import { motion } from "motion/react";

export function CTASection() {
  return (
    <section className="border-t border-landing-border py-24 md:py-32">
      <motion.div
        className="flex flex-col items-center text-center gap-8 max-w-2xl mx-auto px-8"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <h2 className="text-[clamp(2rem,5vw,4rem)] font-medium tracking-[-0.03em] leading-[1.1] text-landing-text">
          Ready to run?
        </h2>
        <div className="font-[family-name:var(--font-mono)] text-sm text-landing-muted">
          1. Claim your profile at straude.com
          <br />
          2. Run one command after your session
          <br />
          3. See who else is putting in the work
        </div>
        <div className="inline-flex items-center gap-4 border border-landing-border bg-black/50 px-6 py-3 font-[family-name:var(--font-mono)] text-lg text-landing-muted">
          ${" "}
          <span className="text-landing-text">
            bunx straude push --days 7
          </span>
        </div>
      </motion.div>
    </section>
  );
}
