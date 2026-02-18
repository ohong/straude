"use client";

import Link from "next/link";
import { useInView } from "@/lib/hooks/useInView";

export function CTASection() {
  const { ref, inView } = useInView(0.3);

  return (
    <section className="bg-accent relative overflow-hidden py-24 md:py-32">
      {/* Pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div
        ref={ref}
        className={`relative z-10 mx-auto flex max-w-[900px] flex-col items-center px-6 text-center md:px-8 transition-all duration-700 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <h2
          className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-tight tracking-[-0.03em] text-white"
          style={{ textWrap: "balance" }}
        >
          Your move.
        </h2>
        <p className="mt-4 text-lg text-white/70 max-w-md">
          Join hundreds of developers who log every session.
        </p>
        <Link
          href="/signup"
          className="group mt-10 inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-base font-bold text-accent transition-all hover:shadow-lg hover:shadow-black/10 md:text-lg"
        >
          Start Your Streak
          <svg
            className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
