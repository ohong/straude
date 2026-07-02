import {
  CopyCommandButton,
  SignupCtaLink,
} from "@/components/landing/LandingActivationActions";
import { ProductHuntBadge } from "@/components/landing/ProductHuntBadge";
import { LANDING_SYNC_COMMAND } from "@/components/landing/constants";

export function CTASection() {
  return (
    <section className="border-t border-landing-border py-24 md:py-32">
      <div
        className="flex flex-col items-center text-center gap-8 max-w-2xl mx-auto px-8 animate-fade-in-up"
      >
        <h2 className="text-[clamp(2rem,5vw,4rem)] font-medium tracking-[-0.03em] leading-[1.1] text-landing-text text-balance">
          Ready to run?
        </h2>
        <div className="font-[family-name:var(--font-mono)] text-sm text-landing-muted">
          1. Claim your profile at straude.com
          <br />
          2. Run one command after your first session
          <br />
          3. Watch Straude confirm the sync
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <SignupCtaLink
            ctaLocation="final_primary"
            className="inline-flex items-center justify-center border border-accent bg-accent px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase text-landing-bg transition-all duration-200 hover:bg-transparent hover:text-accent active:scale-[0.97]"
          >
            Start Your Streak
          </SignupCtaLink>
          <CopyCommandButton
            command={LANDING_SYNC_COMMAND}
            className="inline-flex cursor-pointer items-center gap-4 border border-landing-border bg-landing-panel px-6 py-4 font-[family-name:var(--font-mono)] text-sm text-landing-muted transition-[border-color,transform] hover:border-landing-dim active:scale-[0.97]"
          />
        </div>

        <ProductHuntBadge />
      </div>
    </section>
  );
}
