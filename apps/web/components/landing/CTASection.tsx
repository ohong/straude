import Link from "next/link";

export function CTASection() {
  return (
    <section className="bg-accent py-20 md:py-28">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center px-6 text-center md:px-8">
        <h2
          className="text-[clamp(2rem,4vw,3rem)] font-bold leading-tight tracking-[-0.02em] text-white"
          style={{ textWrap: "balance" }}
        >
          Ready to show the world what you're building?
        </h2>
        <Link
          href="/signup"
          className="mt-10 inline-block rounded-lg bg-white px-8 py-4 text-base font-bold text-accent hover:bg-white/90 md:text-lg"
        >
          Create Your Account
        </Link>
      </div>
    </section>
  );
}
