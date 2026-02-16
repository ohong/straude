import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-12 px-6 md:flex-row md:items-center md:gap-16 md:px-8">
        {/* Text */}
        <div className="flex max-w-xl flex-1 flex-col items-center text-center md:items-start md:text-left">
          <h1
            className="text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[1.05] tracking-[-0.04em]"
            style={{ textWrap: "balance" }}
          >
            Track your Claude Code usage.{" "}
            <span className="text-accent">Share your wins.</span>
          </h1>
          <p
            className="mt-6 text-lg text-muted md:text-xl"
            style={{ textWrap: "pretty" }}
          >
            The social platform for AI-assisted coding.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-lg bg-accent px-8 py-4 text-base font-bold text-white hover:opacity-90 md:text-lg"
          >
            Get Started — It's Free
          </Link>
        </div>

        {/* Hero image placeholder */}
        <div className="flex flex-1 items-center justify-center">
          <div className="relative aspect-[4/3] w-full max-w-lg overflow-hidden rounded-2xl bg-[#F7F5F0]">
            {/* Abstract performance graphic placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                {/* Geometric shapes evoking motion/performance */}
                <div className="flex gap-3">
                  <div className="h-16 w-3 rounded-full bg-accent opacity-40" />
                  <div className="h-24 w-3 rounded-full bg-accent opacity-60" />
                  <div className="h-32 w-3 rounded-full bg-accent opacity-80" />
                  <div className="h-40 w-3 rounded-full bg-accent" />
                  <div className="h-32 w-3 rounded-full bg-accent opacity-80" />
                  <div className="h-24 w-3 rounded-full bg-accent opacity-60" />
                  <div className="h-16 w-3 rounded-full bg-accent opacity-40" />
                </div>
                <div className="mt-2 font-mono text-xs tracking-wider text-muted">
                  npx straude@latest push
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
