import { formatTokens } from "./format";
import type { ShareThemeId } from "../share-themes";
import { getShareTheme } from "../share-themes";

interface SharePostData {
  title: string | null;
  description: string | null;
  images: string[];
  username: string;
  avatar_url: string | null;
  cost_usd: number | null;
  input_tokens: number;
  output_tokens: number;
  models: string[];
  is_verified: boolean;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\[.*?\]\(.+?\)/g, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

function formatModel(models: string[]): string | null {
  if (!models || models.length === 0) return null;
  if (models.some((m) => m.includes("opus"))) return "Opus";
  if (models.some((m) => m.includes("sonnet"))) return "Sonnet";
  if (models.some((m) => m.includes("haiku"))) return "Haiku";
  return models[0];
}

function StatBox({
  label,
  value,
  textPrimary,
  textTertiary,
  accentColor,
}: {
  label: string;
  value: string;
  textPrimary: string;
  textTertiary: string;
  accentColor?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: accentColor ? "#DF561F" : textPrimary,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: textTertiary,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function ShareCardImage({
  post,
  themeId,
}: {
  post: SharePostData;
  themeId: ShareThemeId;
}) {
  const theme = getShareTheme(themeId);
  const size = 1080;
  const padding = 64;

  const hasTitle = !!post.title;
  const hasVerifiedCost = post.is_verified && post.cost_usd != null;
  const model = formatModel(post.models);
  const imageCount = post.images?.length ?? 0;
  const visibleImages = (post.images ?? []).slice(0, 4);
  const overflow = imageCount - 4;

  // Hero text
  let heroText: string;
  let heroSize: number;
  let heroColor: string;
  let heroSubtitle: string | null = null;

  if (hasTitle) {
    heroText = truncate(post.title!, 80);
    heroSize = 44;
    heroColor = theme.textPrimary;
  } else if (hasVerifiedCost) {
    heroText = `$${Number(post.cost_usd).toFixed(2)}`;
    heroSize = 80;
    heroColor = theme.accent;
    heroSubtitle = "session cost";
  } else {
    heroText = `@${post.username}'s coding session`;
    heroSize = 44;
    heroColor = theme.textPrimary;
  }

  // Description
  const desc = post.description
    ? truncate(stripMarkdown(post.description), 150)
    : null;

  // Stats to show
  const stats: { label: string; value: string; accent?: boolean }[] = [];
  if (hasVerifiedCost) {
    stats.push({
      label: "Cost",
      value: `$${Number(post.cost_usd).toFixed(2)}`,
      accent: true,
    });
  }
  if (post.input_tokens > 0) {
    stats.push({ label: "Input", value: formatTokens(post.input_tokens) });
  }
  if (post.output_tokens > 0) {
    stats.push({ label: "Output", value: formatTokens(post.output_tokens) });
  }
  if (model) {
    stats.push({ label: "Model", value: model });
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter",
        position: "relative",
      }}
    >
      {/* Background */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: size,
          background: theme.background,
        }}
      />
      {/* Overlay for gradient themes */}
      {theme.overlay && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size,
            height: size,
            backgroundColor: theme.overlay,
          }}
        />
      )}

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding,
          position: "relative",
          flex: 1,
        }}
      >
        {/* Header: STRAUDE logo left, avatar + username right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32">
              <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
            </svg>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: theme.textPrimary,
                letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
              }}
            >
              STRAUDE
            </div>
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            {post.avatar_url ? (
              <img
                src={post.avatar_url}
                width={36}
                height={36}
                style={{ borderRadius: 18, objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: theme.textTertiary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  color: theme.background === "#0A0A0A" ? "#0A0A0A" : "#fff",
                }}
              >
                {post.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: theme.textSecondary,
              }}
            >
              @{post.username}
            </div>
          </div>
        </div>

        {/* Hero */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 48,
          }}
        >
          <div
            style={{
              fontSize: heroSize,
              fontWeight: 700,
              color: heroColor,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            {heroText}
          </div>
          {heroSubtitle && (
            <div
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: theme.textTertiary,
                marginTop: 8,
                textTransform: "uppercase" as const,
                letterSpacing: "0.1em",
              }}
            >
              {heroSubtitle}
            </div>
          )}
        </div>

        {/* Description */}
        {desc && (
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: theme.textSecondary,
              marginTop: 20,
              lineHeight: 1.5,
            }}
          >
            {desc}
          </div>
        )}

        {/* Stats row */}
        {stats.length > 0 && (
          <div
            style={{
              display: "flex",
              marginTop: 40,
              borderTop: `1px solid ${themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
              borderBottom: `1px solid ${themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
              paddingTop: 24,
              paddingBottom: 24,
            }}
          >
            {stats.map((s) => (
              <StatBox
                key={s.label}
                label={s.label}
                value={s.value}
                textPrimary={theme.textPrimary}
                textTertiary={theme.textTertiary}
                accentColor={s.accent}
              />
            ))}
          </div>
        )}

        {/* Image thumbnails */}
        {visibleImages.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 32,
            }}
          >
            {visibleImages.map((url, i) => (
              <div
                key={url}
                style={{
                  width: 220,
                  height: 140,
                  borderRadius: 8,
                  overflow: "hidden",
                  position: "relative",
                  display: "flex",
                }}
              >
                <img
                  src={url}
                  width={220}
                  height={140}
                  style={{ objectFit: "cover", width: 220, height: 140 }}
                />
                {i === 3 && overflow > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 220,
                      height: 140,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    +{overflow}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer — pushed to bottom */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
          }}
        >
          {/* X logo + @StraudeApp */}
          <div
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={theme.textTertiary}
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <div
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: theme.textTertiary,
              }}
            >
              @StraudeApp
            </div>
          </div>
          {/* straude.com + trapezoid */}
          <div
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: theme.textTertiary,
              }}
            >
              straude.com
            </div>
            <svg width="24" height="24" viewBox="0 0 32 32">
              <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
