import { NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getGithubCardData } from "@/lib/share-assets/github-card-data";
import { getShareTheme } from "@/lib/share-themes";
import {
  buildHeatmapGrid,
  getHeatmapCellColor,
} from "@/lib/share-assets/heatmap";
import type { GithubCardData } from "@/lib/share-assets/github-card-data";

type RouteContext = { params: Promise<{ username: string }> };

// ── helpers ────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCost(cost: number): string {
  if (cost >= 100_000) return `$${(cost / 1_000).toFixed(0)}k`;
  if (cost >= 10_000) return `$${(cost / 1_000).toFixed(1)}k`;
  if (cost >= 1_000) return `$${cost.toFixed(0)}`;
  return `$${cost.toFixed(2)}`;
}

// ── card renderers ─────────────────────────────────────────────────

function renderFullCard(data: GithubCardData, themeId: "light" | "dark"): string {
  const t = getShareTheme(themeId);
  const { cells, weekCount } = buildHeatmapGrid(data.contribution_data, {
    rangeDays: 84,
  });

  const columns = Array.from({ length: weekCount }, (_, wi) =>
    cells.filter((c) => c.weekIndex === wi)
  );

  const heroName = esc(data.display_name?.trim() || `@${data.username}`);
  const subtitle = data.level
    ? `@${esc(data.username)} · Lv ${data.level}`
    : `@${esc(data.username)}`;

  const zeroCostColor =
    themeId === "dark" ? "rgba(255,255,255,0.08)" : "#EAE2D7";

  // Stat blocks
  const stats = [
    { label: "streak", value: `${data.streak}d`, accent: true },
    { label: "rank", value: data.global_rank ? `#${data.global_rank}` : "—", accent: false },
    { label: "active days", value: `${data.active_days_last_30}/30`, accent: false },
    { label: "model", value: data.primary_model, accent: false },
  ];

  const W = 495;
  const H = 270;
  const PAD_X = 24;
  const PAD_Y = 20;
  const CELL = 8;
  const GAP = 2;
  const STAT_H = 44;
  const STAT_GAP = 8;
  const statW = (W - PAD_X * 2 - STAT_GAP * (stats.length - 1)) / stats.length;

  // Heatmap positioning
  const heatmapY = H - PAD_Y - 7 * (CELL + GAP);
  const heatmapLabelW = 28;
  const heatmapAvailW = W - PAD_X * 2 - heatmapLabelW * 2;
  const colGap = Math.max(2, (heatmapAvailW - weekCount * CELL) / Math.max(weekCount - 1, 1));

  let heatmapSvg = "";
  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci];
    const cx = Math.round(PAD_X + heatmapLabelW + ci * (CELL + colGap));
    for (const cell of col) {
      if (!cell.inRange) continue;
      const cy = heatmapY + cell.dayIndex * (CELL + GAP);
      const fill = cell.cost_usd <= 0
        ? zeroCostColor
        : getHeatmapCellColor(cell.cost_usd);
      heatmapSvg += `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"/>`;
    }
  }

  // Stat block SVGs
  let statsSvg = "";
  const statsY = 130;
  for (let i = 0; i < stats.length; i++) {
    const sx = PAD_X + i * (statW + STAT_GAP);
    const stat = stats[i];
    const bgFill = stat.accent ? "rgba(223,86,31,0.10)" : t.surface;
    const borderColor = stat.accent ? "rgba(223,86,31,0.18)" : t.surfaceBorder;
    const valueFill = stat.accent ? t.accent : t.textPrimary;

    statsSvg += `
      <rect x="${sx}" y="${statsY}" width="${statW}" height="${STAT_H}" rx="10" fill="${bgFill}" stroke="${borderColor}" stroke-width="1"/>
      <text x="${sx + 10}" y="${statsY + 18}" fill="${valueFill}" font-size="16" font-weight="700" letter-spacing="-0.02em">${esc(stat.value)}</text>
      <text x="${sx + 10}" y="${statsY + 34}" fill="${t.textTertiary}" font-size="9" font-weight="500" letter-spacing="0.06em" text-transform="uppercase">${esc(stat.label.toUpperCase())}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }</style>
  <rect width="${W}" height="${H}" fill="${t.background}" rx="0"/>

  <!-- Logo + wordmark -->
  <polygon points="${PAD_X + 3.2},${PAD_Y} ${PAD_X + 12.8},${PAD_Y} ${PAD_X + 16},${PAD_Y + 16} ${PAD_X},${PAD_Y + 16}" fill="#DF561F"/>
  <text x="${PAD_X + 22}" y="${PAD_Y + 12}" fill="${t.textPrimary}" font-size="10" font-weight="700" letter-spacing="0.08em">STRAUDE</text>
  <text x="${W - PAD_X}" y="${PAD_Y + 12}" fill="${t.textTertiary}" font-size="10" font-weight="500" text-anchor="end">straude.com</text>

  <!-- Name + spend -->
  <text x="${PAD_X}" y="${PAD_Y + 48}" fill="${t.textPrimary}" font-size="20" font-weight="700" letter-spacing="-0.03em">${heroName}</text>
  <text x="${PAD_X}" y="${PAD_Y + 64}" fill="${t.textTertiary}" font-size="11" font-weight="500">${subtitle}</text>
  <text x="${W - PAD_X}" y="${PAD_Y + 46}" fill="${t.accent}" font-size="26" font-weight="700" text-anchor="end" letter-spacing="-0.03em">${formatCost(data.total_cost)}</text>
  <text x="${W - PAD_X}" y="${PAD_Y + 62}" fill="${t.textTertiary}" font-size="9" font-weight="500" text-anchor="end" letter-spacing="0.06em">TOTAL SPEND</text>

  <!-- Stats -->
  ${statsSvg}

  <!-- Heatmap labels -->
  <text x="${PAD_X}" y="${heatmapY + 7 * (CELL + GAP) / 2 + 3}" fill="${t.textTertiary}" font-size="8" font-weight="700" letter-spacing="0.1em">LESS</text>
  <text x="${W - PAD_X}" y="${heatmapY + 7 * (CELL + GAP) / 2 + 3}" fill="${t.textTertiary}" font-size="8" font-weight="700" letter-spacing="0.1em" text-anchor="end">MORE</text>

  <!-- Heatmap -->
  ${heatmapSvg}
</svg>`;
}

function renderCompactCard(data: GithubCardData, themeId: "light" | "dark"): string {
  const t = getShareTheme(themeId);
  const heroName = esc(data.display_name?.trim() || `@${data.username}`);

  const W = 400;
  const H = 56;

  const stats = [
    { label: "Spend", value: formatCost(data.total_cost) },
    { label: "Streak", value: `${data.streak}d` },
    { label: "Rank", value: data.global_rank ? `#${data.global_rank}` : "—" },
  ];

  let statsSvg = "";
  let sx = 160;
  for (const stat of stats) {
    statsSvg += `
      <text x="${sx}" y="27" fill="${t.textPrimary}" font-size="13" font-weight="700">${esc(stat.value)}</text>
      <text x="${sx}" y="42" fill="${t.textTertiary}" font-size="8" font-weight="500" letter-spacing="0.06em">${esc(stat.label.toUpperCase())}</text>`;
    sx += 80;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }</style>
  <rect width="${W}" height="${H}" fill="${t.background}" rx="0"/>

  <!-- Logo -->
  <polygon points="14,12 23.6,12 27,40 10,40" fill="#DF561F" transform="scale(0.6) translate(8, 6)"/>
  <text x="32" y="27" fill="${t.textPrimary}" font-size="13" font-weight="700" letter-spacing="-0.02em">${heroName}</text>
  <text x="32" y="42" fill="${t.textTertiary}" font-size="9" font-weight="500">@${esc(data.username)}</text>

  ${statsSvg}
</svg>`;
}

function renderPrivateCard(username: string, themeId: "light" | "dark", compact: boolean): string {
  const t = getShareTheme(themeId);

  if (compact) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="56" viewBox="0 0 400 56" fill="none">
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }</style>
  <rect width="400" height="56" fill="${t.background}"/>
  <polygon points="14,12 23.6,12 27,40 10,40" fill="#DF561F" transform="scale(0.6) translate(8, 6)"/>
  <text x="32" y="30" fill="${t.textPrimary}" font-size="13" font-weight="700">@${esc(username)}</text>
  <text x="160" y="30" fill="${t.textTertiary}" font-size="11" font-weight="500">Private profile</text>
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="270" viewBox="0 0 495 270" fill="none">
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }</style>
  <rect width="495" height="270" fill="${t.background}"/>
  <polygon points="14.4,0 25.6,0 32,32 0,32" fill="#DF561F" transform="translate(230, 90) scale(0.56)"/>
  <text x="248" y="98" fill="${t.textPrimary}" font-size="12" font-weight="700" text-anchor="middle" letter-spacing="0.08em">STRAUDE</text>
  <text x="248" y="130" fill="${t.textPrimary}" font-size="16" font-weight="700" text-anchor="middle">@${esc(username)}</text>
  <text x="248" y="152" fill="${t.textTertiary}" font-size="13" font-weight="500" text-anchor="middle">This profile is private</text>
</svg>`;
}

// ── route handler ──────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const sp = request.nextUrl.searchParams;
  const themeId = sp.get("theme") === "dark" ? "dark" as const : "light" as const;
  const compact = sp.get("compact") === "1";

  const db = getServiceClient();

  const { data: profile } = await db
    .from("users")
    .select("id, username, display_name, is_public")
    .eq("username", username)
    .single();

  if (!profile?.username) {
    return new Response("Not found", { status: 404 });
  }

  if (!profile.is_public) {
    return new Response(renderPrivateCard(profile.username, themeId, compact), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  }

  try {
    const data = await getGithubCardData(db, profile);
    const svg = compact
      ? renderCompactCard(data, themeId)
      : renderFullCard(data, themeId);

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=7200, s-maxage=7200, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("SVG embed generation failed:", error);
    return new Response("SVG generation failed", { status: 500 });
  }
}
