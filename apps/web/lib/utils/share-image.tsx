import { formatTokens } from "./format";
import { getShareModelLabel } from "./post-share";
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
  return `${text.slice(0, max - 3)}...`;
}

function StatCard({
  label,
  value,
  accent,
  themeId,
}: {
  label: string;
  value: string;
  accent?: boolean;
  themeId: ShareThemeId;
}) {
  const theme = getShareTheme(themeId);
  const valueSize = value.length > 12 ? 26 : value.length > 8 ? 30 : 34;

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minWidth: 0,
        flexDirection: "column",
        borderRadius: 28,
        padding: "18px 20px",
        backgroundColor: accent ? theme.surface : theme.surfaceSecondary,
        border: `1px solid ${theme.surfaceBorder}`,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: theme.textTertiary,
          textTransform: "uppercase" as const,
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: valueSize,
          fontWeight: 700,
          color: accent ? theme.accent : theme.textPrimary,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MediaTile({
  src,
  title,
  body,
  footer,
  themeId,
  large = false,
}: {
  src?: string | null;
  title: string;
  body: string;
  footer?: string;
  themeId: ShareThemeId;
  large?: boolean;
}) {
  const theme = getShareTheme(themeId);
  const radius = large ? 36 : 30;
  const padding = large ? 28 : 22;

  if (src) {
    return (
      <div
        style={{
          display: "flex",
          position: "relative",
          flex: 1,
          overflow: "hidden",
          borderRadius: radius,
          border: `1px solid ${theme.surfaceBorder}`,
          backgroundColor: theme.surfaceSecondary,
        }}
      >
        <img
          src={src}
          width={large ? 320 : 152}
          height={large ? 356 : 146}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            display: "flex",
            borderRadius: 999,
            backgroundColor: "rgba(10,10,10,0.68)",
            padding: "8px 12px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
            }}
          >
            {title}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minWidth: 0,
        flexDirection: "column",
        justifyContent: "space-between",
        borderRadius: radius,
        padding,
        backgroundColor: large ? theme.surface : theme.surfaceSecondary,
        border: `1px solid ${theme.surfaceBorder}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            backgroundColor: theme.accent,
          }}
        />
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.textTertiary,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontSize: large ? 34 : 22,
            fontWeight: 700,
            color: theme.textPrimary,
            lineHeight: 1.1,
          }}
        >
          {body}
        </div>
        {footer && (
          <div
            style={{
              marginTop: 8,
              fontSize: large ? 18 : 15,
              fontWeight: 500,
              color: theme.textSecondary,
              lineHeight: 1.35,
            }}
          >
            {footer}
          </div>
        )}
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
  const padding = 56;

  const description = post.description
    ? truncate(stripMarkdown(post.description), 150)
    : null;
  const model = getShareModelLabel(post.models);
  const cost =
    typeof post.cost_usd === "number" && Number.isFinite(post.cost_usd)
      ? `$${post.cost_usd.toFixed(2)}`
      : null;
  const visibleImages = (post.images ?? []).slice(0, 3);
  const imageCount = post.images?.length ?? 0;

  const heroLabel = post.is_verified
    ? "Verified Claude Code session"
    : "Claude Code session";

  const heroText = post.title?.trim()
    ? truncate(post.title.trim(), 84)
    : cost
      ? `${cost} of coding energy`
      : `@${post.username}'s build log`;

  const heroSize = cost && !post.title ? 84 : heroText.length > 42 ? 52 : 62;
  const heroSupport =
    description ??
    (imageCount > 0
      ? `${imageCount} screenshot${imageCount === 1 ? "" : "s"} from the session, ready to post on X, LinkedIn, or stories.`
      : "Track the work, package the proof, and turn every session into something worth sharing.");

  const stats: Array<{ label: string; value: string; accent?: boolean }> = [];
  if (cost) stats.push({ label: "Spend", value: cost, accent: post.is_verified });
  if (post.output_tokens > 0) {
    stats.push({ label: "Output", value: formatTokens(post.output_tokens) });
  }
  if (model) {
    stats.push({ label: "Model", value: model });
  }
  if (stats.length < 3 && imageCount > 0) {
    stats.push({
      label: "Shots",
      value: `${imageCount}`,
    });
  }
  if (stats.length < 3 && post.input_tokens > 0) {
    stats.push({ label: "Input", value: formatTokens(post.input_tokens) });
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
      }}
    >
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
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -70,
          width: 340,
          height: 340,
          borderRadius: 999,
          backgroundColor: theme.spotlightPrimary,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: -60,
          width: 260,
          height: 260,
          borderRadius: 999,
          backgroundColor: theme.spotlightSecondary,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 44,
          bottom: 44,
          width: 220,
          height: 220,
          borderRadius: 42,
          border: `1px solid ${theme.surfaceBorder}`,
          opacity: 0.8,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          padding,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderRadius: 999,
              backgroundColor: theme.badgeBackground,
              border: `1px solid ${theme.badgeBorder}`,
              padding: "12px 18px",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 32 32">
              <polygon points="6.4,0 25.6,0 32,32 0,32" fill={theme.accent} />
            </svg>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: theme.textPrimary,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
              }}
            >
              STRAUDE
            </div>
          </div>

          <div
            style={{
              display: "flex",
              borderRadius: 999,
              backgroundColor: theme.surfaceSecondary,
              border: `1px solid ${theme.surfaceBorder}`,
              padding: "12px 18px",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: theme.textSecondary,
              }}
            >
              Strava for coding
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 28,
            marginTop: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              minWidth: 0,
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 14,
                fontWeight: 700,
                color: theme.accent,
                textTransform: "uppercase" as const,
                letterSpacing: "0.12em",
              }}
            >
              {heroLabel}
            </div>

            <div
              style={{
                marginTop: 18,
                fontSize: heroSize,
                fontWeight: 700,
                color: theme.textPrimary,
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
              }}
            >
              {heroText}
            </div>

            <div
              style={{
                marginTop: 22,
                fontSize: 24,
                fontWeight: 500,
                color: theme.textSecondary,
                lineHeight: 1.45,
              }}
            >
              {heroSupport}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 28,
              }}
            >
              {post.avatar_url ? (
                <img
                  src={post.avatar_url}
                  width={54}
                  height={54}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 999,
                    objectFit: "cover",
                    border: `1px solid ${theme.surfaceBorder}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    width: 54,
                    height: 54,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.surfaceBorder}`,
                    color: theme.textPrimary,
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  {post.username.charAt(0).toUpperCase()}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: theme.textPrimary,
                  }}
                >
                  {`@${post.username}`}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: theme.textSecondary,
                  }}
                >
                  Build in public on Straude
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: "auto",
              }}
            >
              {stats.slice(0, 3).map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  accent={stat.accent}
                  themeId={themeId}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: 320,
              flexDirection: "column",
              gap: 16,
            }}
          >
            <MediaTile
              src={visibleImages[0]}
              title={
                imageCount > 1 ? `${imageCount} uploads` : visibleImages[0] ? "Session capture" : "Share-ready"
              }
              body={cost ?? "Clean social card"}
              footer={
                visibleImages[0]
                  ? undefined
                  : "Export a square PNG instead of relying on screenshots."
              }
              themeId={themeId}
              large
            />

            <div
              style={{
                display: "flex",
                gap: 16,
                height: 146,
              }}
            >
              <MediaTile
                src={visibleImages[1]}
                title={visibleImages[1] ? "More context" : "Model"}
                body={visibleImages[1] ? "" : model ?? "Claude Code"}
                footer={
                  visibleImages[1]
                    ? undefined
                    : model ? "Most-used model in this session." : "Show what you are building."
                }
                themeId={themeId}
              />
              <MediaTile
                src={visibleImages[2]}
                title={visibleImages[2] ? "Visual proof" : "Call to action"}
                body={visibleImages[2] ? "" : "straude.com"}
                footer={
                  visibleImages[2]
                    ? undefined
                    : "Track your Claude Code and turn each session into a post."
                }
                themeId={themeId}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 26,
            paddingTop: 22,
            borderTop: `1px solid ${theme.surfaceBorder}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 20,
              fontWeight: 600,
              color: theme.textSecondary,
            }}
          >
            Track your Claude Code at straude.com
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 999,
              backgroundColor: theme.badgeBackground,
              border: `1px solid ${theme.badgeBorder}`,
              padding: "10px 16px",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: theme.accent,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
              }}
            >
              Share the build
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
