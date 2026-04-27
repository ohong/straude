import { formatCurrency, formatTokens } from "@/lib/utils/format";
import { getShareModelLabel } from "@/lib/utils/post-share";
import { getShareTheme, type ShareThemeId } from "@/lib/share-themes";

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

function prettifyModel(model: string): string {
  const normalized = model.trim();
  if (/claude-opus-4/i.test(normalized)) return "Claude Opus";
  if (/claude-sonnet-4/i.test(normalized)) return "Claude Sonnet";
  if (/claude-haiku-4/i.test(normalized)) return "Claude Haiku";
  if (/^gpt-/i.test(normalized)) {
    return normalized
      .replace(/^gpt/i, "GPT")
      .replace(/-codex$/i, "-Codex");
  }
  if (/^o4/i.test(normalized)) return "o4";
  if (/^o3/i.test(normalized)) return "o3";
  return normalized;
}

function summarizeModels(models: string[]) {
  const unique = Array.from(
    new Set(models.map((model) => prettifyModel(model)).filter(Boolean))
  );

  if (unique.length === 0) return null;
  if (unique.length <= 2) return unique.join(" + ");
  return `${unique.slice(0, 2).join(" + ")} +${unique.length - 2}`;
}

function Metric({
  label,
  value,
  themeId,
  accent = false,
}: {
  label: string;
  value: string;
  themeId: ShareThemeId;
  accent?: boolean;
}) {
  const theme = getShareTheme(themeId);

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minWidth: 0,
        flexDirection: "column",
        borderRadius: 24,
        padding: "18px 20px",
        backgroundColor: accent ? theme.surface : theme.surfaceSecondary,
        border: `1px solid ${theme.surfaceBorder}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: theme.textTertiary,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: value.length > 16 ? 22 : 28,
          fontWeight: 700,
          color: accent ? theme.accent : theme.textPrimary,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function PostCardImage({
  post,
  themeId,
}: {
  post: SharePostData;
  themeId: ShareThemeId;
}) {
  const theme = getShareTheme(themeId);
  const width = 1200;
  const height = 630;
  const padding = 52;
  const cost =
    typeof post.cost_usd === "number" && Number.isFinite(post.cost_usd)
      ? `$${formatCurrency(post.cost_usd)}`
      : null;
  const input = post.input_tokens > 0 ? `${formatTokens(post.input_tokens)} tokens` : null;
  const output = post.output_tokens > 0 ? `${formatTokens(post.output_tokens)} tokens` : null;
  const primaryModel = getShareModelLabel(post.models);
  const modelSummary = summarizeModels(post.models) ?? primaryModel;
  const title = post.title?.trim()
    ? truncate(post.title.trim(), 48)
    : `A session from @${post.username}`;
  const body = post.description?.trim()
    ? truncate(stripMarkdown(post.description), 180)
    : "Tracked on Straude. Share the session, the pace, and the proof without posting a screenshot of your dashboard.";
  const heroImage = post.images?.[0] ?? null;
  const statusLabel = post.is_verified ? "verified session" : "session";
  const metrics = [
    cost ? { label: "Spend", value: cost, accent: post.is_verified } : null,
    input ? { label: "Input", value: input } : null,
    output ? { label: "Output", value: output } : null,
    modelSummary ? { label: "Models", value: modelSummary } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; accent?: boolean }>;

  return (
    <div
      style={{
        width,
        height,
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
          width,
          height,
          background: theme.background,
        }}
      />
      {theme.overlay && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundColor: theme.overlay,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          top: -110,
          right: -90,
          width: 280,
          height: 280,
          borderRadius: 999,
          backgroundColor: theme.spotlightPrimary,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -70,
          bottom: -100,
          width: 220,
          height: 220,
          borderRadius: 999,
          backgroundColor: theme.spotlightSecondary,
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
            }}
          >
            <svg width="30" height="30" viewBox="0 0 32 32">
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
              backgroundColor: theme.badgeBackground,
              border: `1px solid ${theme.badgeBorder}`,
              padding: "10px 16px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: theme.accent,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
              }}
            >
              {statusLabel}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 26,
            marginTop: 28,
            flex: 1,
            alignItems: "stretch",
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
                fontSize: 14,
                fontWeight: 700,
                color: theme.accent,
                letterSpacing: "0.14em",
                textTransform: "uppercase" as const,
              }}
            >
              {`@${post.username}`}
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: title.length > 34 ? 40 : 46,
                fontWeight: 700,
                color: theme.textPrimary,
                lineHeight: 1.02,
                letterSpacing: "-0.04em",
                whiteSpace: "nowrap" as const,
              }}
            >
              {title}
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 19,
                fontWeight: 500,
                color: theme.textSecondary,
                lineHeight: 1.45,
              }}
            >
              {body}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap" as const,
                gap: 14,
                marginTop: 24,
              }}
            >
              {metrics.length > 0 ? (
                metrics.map((metric) => (
                  <div
                    key={metric.label}
                    style={{
                      display: "flex",
                      width: "49%",
                    }}
                  >
                    <Metric
                      label={metric.label}
                      value={metric.value}
                      themeId={themeId}
                      accent={metric.accent}
                    />
                  </div>
                ))
              ) : (
                <Metric label="Source" value="Claude Code" themeId={themeId} />
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 20,
                padding: "16px 18px",
                borderRadius: 24,
                backgroundColor: theme.surfaceSecondary,
                border: `1px solid ${theme.surfaceBorder}`,
              }}
            >
              {post.avatar_url ? (
                <img
                  src={post.avatar_url}
                  width={46}
                  height={46}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 999,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    width: 46,
                    height: 46,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.surface,
                    color: theme.textPrimary,
                    fontSize: 20,
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
                    fontSize: 12,
                    fontWeight: 700,
                    color: theme.textTertiary,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                  }}
                >
                  Tracked on Straude
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 20,
                    fontWeight: 700,
                    color: theme.textPrimary,
                  }}
                >
                  {`@${post.username}`}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: 320,
              flexDirection: "column",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                overflow: "hidden",
                minHeight: heroImage ? 300 : 0,
                borderRadius: 34,
                border: `1px solid ${theme.surfaceBorder}`,
                backgroundColor: theme.surface,
              }}
            >
              {heroImage ? (
                <img
                  src={heroImage}
                  width={320}
                  height={300}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                    padding: 26,
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
                        display: "flex",
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        backgroundColor: theme.accent,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: theme.textTertiary,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase" as const,
                      }}
                    >
                      Shareable proof
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        fontSize: 30,
                        fontWeight: 700,
                        color: theme.textPrimary,
                        lineHeight: 1.08,
                      }}
                    >
                      Post the work.
                      <br />
                      Keep the context.
                    </div>
                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 16,
                        fontWeight: 500,
                        color: theme.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      Better than screenshotting a dashboard and hoping the story survives the crop.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
