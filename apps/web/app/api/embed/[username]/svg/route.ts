import { NextRequest } from "next/server";
import { formatTokens } from "@straude/shared/format";
import { getServiceClient } from "@/lib/supabase/service";
import { getProfileShareCardData } from "@/lib/share-assets/profile-card-data";
import {
  buildHeatmapGrid,
  getHeatmapCellColor,
  getHeatmapLegend,
} from "@/lib/share-assets/heatmap";
import type { ProfileShareCardData } from "@/lib/share-assets/profile-card-data";

type RouteContext = { params: Promise<{ username: string }> };

// ── helpers ────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── SVG gradient workaround ────────────────────────────────────────
// SVG <rect> doesn't support CSS `linear-gradient()`. We use a
// <linearGradient> def for the warm background matching the stats card.
//
// Dark theme uses a flat color instead.

function bgDefs(dark: boolean): string {
  if (dark) return "";
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FBF5EE"/>
      <stop offset="52%" stop-color="#F4E7D7"/>
      <stop offset="100%" stop-color="#F0D0B6"/>
    </linearGradient>
  </defs>`;
}

function bgFill(dark: boolean): string {
  return dark ? "#0A0A0A" : "url(#bg)";
}

// ── theme palette ──────────────────────────────────────────────────

function palette(dark: boolean) {
  if (dark) {
    return {
      textPrimary: "#FFFFFF",
      textSecondary: "#D4D4D8",
      textMuted: "#A1A1AA",
      labelColor: "#71717A",
      accent: "#DF561F",
      accentDark: "#DF561F",
      surface: "rgba(24,24,27,0.82)",
      surfaceBorder: "rgba(255,255,255,0.10)",
      accentSurface: "rgba(223,86,31,0.15)",
      accentBorder: "rgba(223,86,31,0.25)",
      heatmapPanel: "rgba(24,24,27,0.60)",
      heatmapPanelBorder: "rgba(255,255,255,0.08)",
      heatmapZero: "rgba(255,255,255,0.06)",
      heatmapCellBorder: "rgba(255,255,255,0.04)",
      spotlightA: "rgba(223,86,31,0.12)",
      spotlightB: "rgba(251,191,36,0.08)",
    };
  }
  return {
    textPrimary: "#201914",
    textSecondary: "#705D4F",
    textMuted: "#7C6656",
    labelColor: "#8B6B57",
    accent: "#B7461D",
    accentDark: "#B7461D",
    surface: "rgba(255,255,255,0.82)",
    surfaceBorder: "rgba(39,30,22,0.08)",
    accentSurface: "rgba(223,86,31,0.10)",
    accentBorder: "rgba(223,86,31,0.18)",
    heatmapPanel: "rgba(255,251,246,0.74)",
    heatmapPanelBorder: "rgba(39,30,22,0.08)",
    heatmapZero: "#EAE2D7",
    heatmapCellBorder: "rgba(39,30,22,0.04)",
    spotlightA: "rgba(223,86,31,0.10)",
    spotlightB: "rgba(248,183,103,0.16)",
  };
}

// ── full card (matches /stats profile card) ────────────────────────

function renderFullCard(data: ProfileShareCardData, dark: boolean): string {
  const t = palette(dark);
  const { cells, monthLabels, weekCount } = buildHeatmapGrid(data.contribution_data);
  const legend = getHeatmapLegend();
  const columns = Array.from({ length: weekCount }, (_, wi) =>
    cells.filter((c) => c.weekIndex === wi)
  );

  const heroName = esc(data.display_name?.trim() || `@${data.username}`);

  // Layout constants — proportional to 1200×630 original
  const W = 800;
  const H = 420;
  const PAD = 30;

  // Heatmap geometry
  const CELL = 9;
  const CELL_GAP = 3;
  const DAY_LABEL_W = 24;
  const heatmapLeft = PAD + DAY_LABEL_W + 8;
  const heatmapAvailW = W - heatmapLeft - PAD;
  const colStep = Math.max(CELL + 1, heatmapAvailW / weekCount);

  // Heatmap panel
  const panelX = PAD;
  const panelY = 126;
  const panelW = W - PAD * 2;
  const panelH = 185;
  const heatmapTopY = panelY + 32;

  // Month labels
  let monthSvg = "";
  for (const ml of monthLabels) {
    const mx = Math.round(heatmapLeft + ml.weekIndex * colStep);
    monthSvg += `<text x="${mx}" y="${panelY + 20}" fill="${t.labelColor}" font-size="9" font-weight="600">${esc(ml.label)}</text>`;
  }

  // Day-of-week labels
  const dayLabels = ["Sun", "", "Tue", "", "Thu", "", "Sat"];
  let dayLabelSvg = "";
  for (let di = 0; di < dayLabels.length; di++) {
    if (!dayLabels[di]) continue;
    const ly = heatmapTopY + di * (CELL + CELL_GAP) + CELL - 1;
    dayLabelSvg += `<text x="${PAD + 8}" y="${ly}" fill="${t.labelColor}" font-size="8" font-weight="600">${dayLabels[di]}</text>`;
  }

  // Heatmap cells
  let heatmapSvg = "";
  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci];
    const cx = Math.round(heatmapLeft + ci * colStep);
    for (const cell of col) {
      if (!cell.inRange) continue;
      const cy = heatmapTopY + cell.dayIndex * (CELL + CELL_GAP);
      const fill = getHeatmapCellColor(cell.cost_usd);
      heatmapSvg += `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" rx="3" fill="${fill}" stroke="${t.heatmapCellBorder}" stroke-width="0.5"/>`;
    }
  }

  // Legend row
  const legendY = panelY + panelH - 18;
  let legendSvg = `<text x="${heatmapLeft}" y="${legendY}" fill="${t.labelColor}" font-size="8" font-weight="700" letter-spacing="0.16em">LESS</text>`;
  const legendStartX = heatmapLeft + 38;
  for (let i = 0; i < legend.length; i++) {
    const lx = legendStartX + i * (CELL + 5);
    legendSvg += `<rect x="${lx}" y="${legendY - 9}" width="${CELL}" height="${CELL}" rx="3" fill="${legend[i].color}"/>`;
  }
  const moreX = legendStartX + legend.length * (CELL + 5) + 4;
  legendSvg += `<text x="${moreX}" y="${legendY}" fill="${t.labelColor}" font-size="8" font-weight="700" letter-spacing="0.16em">MORE</text>`;

  // Stat blocks
  const stats = [
    { label: "Output Total", value: `${formatTokens(data.total_output_tokens)} tokens`, accent: true },
    { label: "Recent 30d", value: `${formatTokens(data.recent_output_tokens)} tokens`, accent: false },
    { label: "Active 30d", value: `${data.active_days_last_30} days`, accent: false },
    { label: "Most Used", value: data.primary_model, accent: false },
  ];

  const statY = panelY + panelH + 14;
  const STAT_GAP = 10;
  const statW = (panelW - STAT_GAP * (stats.length - 1)) / stats.length;
  const STAT_H = 52;
  let statsSvg = "";
  for (let i = 0; i < stats.length; i++) {
    const sx = PAD + i * (statW + STAT_GAP);
    const s = stats[i];
    const bg = s.accent ? t.accentSurface : t.surface;
    const border = s.accent ? t.accentBorder : t.surfaceBorder;
    const valColor = s.accent ? t.accentDark : t.textPrimary;
    const fontSize = s.value.length > 14 ? 14 : 17;
    statsSvg += `
      <rect x="${sx}" y="${statY}" width="${statW}" height="${STAT_H}" rx="14" fill="${bg}" stroke="${border}" stroke-width="1"/>
      <text x="${sx + 12}" y="${statY + 17}" fill="${t.textMuted}" font-size="8" font-weight="600" letter-spacing="0.12em">${esc(s.label.toUpperCase())}</text>
      <text x="${sx + 12}" y="${statY + 40}" fill="${valColor}" font-size="${fontSize}" font-weight="700" letter-spacing="-0.03em">${esc(s.value)}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }</style>
  ${bgDefs(dark)}
  <rect width="${W}" height="${H}" fill="${bgFill(dark)}"/>

  <!-- Decorative spots -->
  <circle cx="${W + 30}" cy="-40" r="180" fill="${t.spotlightA}"/>
  <circle cx="-50" cy="${H + 50}" r="160" fill="${t.spotlightB}"/>

  <!-- Logo + wordmark -->
  <g transform="translate(${PAD}, ${PAD - 2})">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#DF561F"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/></svg>
  </g>
  <text x="${PAD + 22}" y="${PAD + 12}" fill="${t.textPrimary}" font-size="12" font-weight="700" letter-spacing="0.08em">STRAUDE</text>

  <!-- Name -->
  <text x="${PAD}" y="${PAD + 46}" fill="${t.textPrimary}" font-size="28" font-weight="700" letter-spacing="-0.04em">${heroName}</text>
  <text x="${PAD}" y="${PAD + 64}" fill="${t.textSecondary}" font-size="12" font-weight="500">@${esc(data.username)}</text>

  <!-- Streak (top right) -->
  <text x="${W - PAD}" y="${PAD + 12}" fill="${t.labelColor}" font-size="9" font-weight="700" letter-spacing="0.16em" text-anchor="end">CURRENT STREAK</text>
  <text x="${W - PAD}" y="${PAD + 48}" fill="${t.accent}" font-size="36" font-weight="700" letter-spacing="-0.04em" text-anchor="end">${data.streak}d</text>
  <text x="${W - PAD}" y="${PAD + 64}" fill="${t.textMuted}" font-size="10" font-weight="500" text-anchor="end">straude.com/stats/${esc(data.username)}</text>

  <!-- Heatmap panel -->
  <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="16" fill="${t.heatmapPanel}" stroke="${t.heatmapPanelBorder}" stroke-width="1"/>
  ${monthSvg}
  ${dayLabelSvg}
  ${heatmapSvg}
  ${legendSvg}

  <!-- Stats -->
  ${statsSvg}
</svg>`;
}

// ── compact card ───────────────────────────────────────────────────

function renderCompactCard(data: ProfileShareCardData, dark: boolean): string {
  const t = palette(dark);
  const heroName = esc(data.display_name?.trim() || `@${data.username}`);

  const W = 480;
  const H = 56;

  const stats = [
    { label: "Streak", value: `${data.streak}d` },
    { label: "Output", value: formatTokens(data.total_output_tokens) },
    { label: "Active", value: `${data.active_days_last_30}/30` },
  ];

  let statsSvg = "";
  let sx = 200;
  for (const stat of stats) {
    statsSvg += `
      <text x="${sx}" y="25" fill="${t.textPrimary}" font-size="14" font-weight="700">${esc(stat.value)}</text>
      <text x="${sx}" y="40" fill="${t.textMuted}" font-size="8" font-weight="500" letter-spacing="0.06em">${esc(stat.label.toUpperCase())}</text>`;
    sx += 94;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }</style>
  ${bgDefs(dark)}
  <rect width="${W}" height="${H}" fill="${bgFill(dark)}"/>

  <!-- Logo -->
  <g transform="translate(12, 16)">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#DF561F"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/></svg>
  </g>
  <text x="32" y="25" fill="${t.textPrimary}" font-size="14" font-weight="700" letter-spacing="-0.02em">${heroName}</text>
  <text x="32" y="40" fill="${t.textMuted}" font-size="9" font-weight="500">@${esc(data.username)}</text>

  ${statsSvg}
</svg>`;
}

// ── private card ───────────────────────────────────────────────────

function renderPrivateCard(username: string, dark: boolean, compact: boolean): string {
  const t = palette(dark);

  if (compact) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="56" viewBox="0 0 480 56" fill="none">
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }</style>
  ${bgDefs(dark)}
  <rect width="480" height="56" fill="${bgFill(dark)}"/>
  <g transform="translate(12, 16)">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#DF561F"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/></svg>
  </g>
  <text x="32" y="30" fill="${t.textPrimary}" font-size="14" font-weight="700">@${esc(username)}</text>
  <text x="200" y="30" fill="${t.textMuted}" font-size="12" font-weight="500">Private profile</text>
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420" fill="none">
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }</style>
  ${bgDefs(dark)}
  <rect width="800" height="420" fill="${bgFill(dark)}"/>
  <g transform="translate(390, 140)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#DF561F"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/></svg>
  </g>
  <text x="400" y="178" fill="${t.textPrimary}" font-size="14" font-weight="700" text-anchor="middle" letter-spacing="0.08em">STRAUDE</text>
  <text x="400" y="210" fill="${t.textPrimary}" font-size="22" font-weight="700" text-anchor="middle">@${esc(username)}</text>
  <text x="400" y="236" fill="${t.textMuted}" font-size="14" font-weight="500" text-anchor="middle">This profile is private</text>
</svg>`;
}

// ── route handler ──────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const sp = request.nextUrl.searchParams;
  const dark = sp.get("theme") === "dark";
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
    return new Response(renderPrivateCard(profile.username, dark, compact), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  }

  try {
    const data = await getProfileShareCardData(db, profile);
    const svg = compact
      ? renderCompactCard(data, dark)
      : renderFullCard(data, dark);

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
