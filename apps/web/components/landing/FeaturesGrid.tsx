export function FeaturesGrid() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 border-t border-landing-border">
      {/* Section title block */}
      <div className="lg:col-span-4 border-b border-r-0 lg:border-r border-landing-border p-8 lg:p-16 flex flex-col justify-between gap-12 bg-landing-bg">
        <h2 className="text-accent font-medium text-[clamp(2rem,5vw,4rem)] leading-none tracking-[-0.03em]">
          01
        </h2>
        <div>
          <h3 className="text-landing-text text-xl font-medium tracking-[-0.03em] leading-tight mb-2">
            Telemetry for
            <br />
            Claude Code.
          </h3>
          <p className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-landing-muted">
            Core Capabilities
          </p>
        </div>
      </div>

      {/* Feature cards 2x2 */}
      <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 border-b border-landing-border">
        <FeatureCard
          icon="[$]"
          title="Track Spend"
          description="Real-time token counting and cost attribution per session."
          className="border-b sm:border-r border-landing-border"
        />
        <FeatureCard
          icon="[~]"
          title="Compare Pace"
          description="Velocity metrics. See how fast you iterate compared to global baselines."
          className="border-b border-landing-border"
        />
        <FeatureCard
          icon="[*]"
          title="Keep Streaks"
          description="Daily commits aren't enough. Maintain your AI engineering streak."
          className="border-b sm:border-b-0 sm:border-r border-landing-border"
        />
        <FeatureCard
          icon="[>]"
          title="Share Progress"
          description="Share your journey with other motivated builders. Show your proof-of-work."
        />
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  className,
}: {
  icon: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={`p-8 lg:p-12 flex flex-col gap-6 transition-colors duration-300 hover:bg-accent/5 ${className ?? ""}`}
    >
      <span className="font-[family-name:var(--font-mono)] text-3xl text-accent">
        {icon}
      </span>
      <h4 className="text-landing-text font-medium text-base">{title}</h4>
      <p className="font-[family-name:var(--font-mono)] text-sm text-landing-muted leading-relaxed">
        {description}
      </p>
    </div>
  );
}
