"use client";

/**
 * OG Image page — rendered at exactly 1200×630 and screenshotted
 * to produce /public/og-image.png for social sharing.
 *
 * Visit /og-image locally to preview.
 */
export default function OGImagePage() {
  return (
    <>
      {/* Hide Next.js dev indicators */}
      <style>{`
        [data-nextjs-dialog-overlay],
        [data-nextjs-dialog],
        nextjs-portal,
        #__next-build-indicator,
        [data-agentation],
        .agentation-widget,
        body > div:last-child > button {
          display: none !important;
        }
      `}</style>

      <div
        style={{
          width: 1200,
          height: 630,
          background: "#050505",
          color: "#F0F0F0",
          fontFamily: "Inter, system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background image */}
        <img
          src="/hero-alt.png"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Darken overlay for text readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.75) 50%, rgba(5,5,5,0.45) 100%)",
          }}
        />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Logo + brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <svg
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              fill="#DF561F"
              width={36}
              height={36}
            >
              <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
            </svg>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 700,
                fontSize: 28,
                letterSpacing: "0.02em",
              }}
            >
              STRAUDE
            </span>
          </div>

          {/* Tagline */}
          <h1
            style={{
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 24,
              textShadow: "0 2px 20px rgba(0,0,0,0.6)",
            }}
          >
            Code like
            <br />
            an athlete.
          </h1>

          {/* Description */}
          <p
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 20,
              color: "#BBBBBB",
              margin: 0,
              maxWidth: 560,
              lineHeight: 1.5,
              textShadow: "0 1px 8px rgba(0,0,0,0.5)",
            }}
          >
            Track your Claude Code spend. Compete with friends. Share your breakthrough sessions.
          </p>
        </div>

        {/* Terminal preview — right side */}
        <div
          style={{
            position: "absolute",
            right: 80,
            bottom: 80,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 14,
            lineHeight: 1.8,
            color: "#AAAAAA",
            textShadow: "0 1px 6px rgba(0,0,0,0.7)",
            background: "rgba(0,0,0,0.45)",
            padding: "12px 16px",
            borderRadius: 4,
          }}
        >
          <div style={{ color: "#F0F0F0" }}>&gt; npx straude</div>
          <div>
            Tokens: <span style={{ color: "#F0F0F0" }}>27.8M</span>
          </div>
          <div>
            Est. Cost: <span style={{ color: "#DF561F" }}>$19.93</span>
          </div>
          <div style={{ color: "#DF561F" }}>
            [OK] Streak: 18 days
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: 80,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 16,
            color: "#777777",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          straude.com
        </div>
      </div>
    </>
  );
}
