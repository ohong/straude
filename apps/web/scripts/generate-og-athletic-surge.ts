import sharp from "sharp";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const WIDTH = 1200;
const HEIGHT = 630;
const BATCH_ID = "feed-social-proof-athletic-surge";
const OUTPUT_DIR = resolve(process.cwd(), "og-variants", BATCH_ID);
const FINAL_DIR = join(OUTPUT_DIR, "final");
const MANIFEST_PATH = join(OUTPUT_DIR, "manifest.json");
const CONTACT_SHEET_PATH = join(OUTPUT_DIR, "contact-sheet.png");
const BASE_IMAGE_PATH = resolve(
  process.cwd(),
  "og-variants",
  "feed-social-proof-real-users-round2",
  "final",
  "title-fix-v2.png",
);
const SURGE_IMAGE_PATH = resolve(process.cwd(), "public", "hero-alt.png");
const INTER_BOLD_PATH = resolve(process.cwd(), "assets", "Inter-Bold.ttf");
const INTER_MEDIUM_PATH = resolve(process.cwd(), "assets", "Inter-Medium.ttf");

type VariantConfig = {
  id: string;
  label: string;
  heroOpacity: number;
  heroLeft: number;
  heroTop: number;
  heroWidth: number;
  heroHeight: number;
  leftGlowOpacity: number;
  rightGlowOpacity: number;
  lineOpacity: number;
  lineBlurOpacity: number;
};

type ManifestEntry = VariantConfig & {
  finalPath: string;
};

const VARIANTS: VariantConfig[] = [
  {
    id: "athletic-surge-balanced",
    label: "Athletic Surge Balanced",
    heroOpacity: 0.42,
    heroLeft: -64,
    heroTop: -116,
    heroWidth: 1320,
    heroHeight: 744,
    leftGlowOpacity: 0.18,
    rightGlowOpacity: 0.46,
    lineOpacity: 0.2,
    lineBlurOpacity: 0.14,
  },
  {
    id: "athletic-surge-push",
    label: "Athletic Surge Push",
    heroOpacity: 0.54,
    heroLeft: -112,
    heroTop: -156,
    heroWidth: 1380,
    heroHeight: 778,
    leftGlowOpacity: 0.24,
    rightGlowOpacity: 0.58,
    lineOpacity: 0.28,
    lineBlurOpacity: 0.2,
  },
];

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function dataUri(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function buildOverlaySvg(
  variant: VariantConfig,
  interBold: Buffer,
  interMedium: Buffer,
): Buffer {
  const interBoldData = dataUri(interBold, "font/ttf");
  const interMediumData = dataUri(interMedium, "font/ttf");

  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @font-face {
            font-family: 'Inter';
            src: url('${interMediumData}') format('truetype');
            font-style: normal;
            font-weight: 500;
          }
          @font-face {
            font-family: 'Inter';
            src: url('${interBoldData}') format('truetype');
            font-style: normal;
            font-weight: 700;
          }
        </style>
        <linearGradient id="leftScrim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(3,4,7,0.995)" />
          <stop offset="68%" stop-color="rgba(5,7,10,0.97)" />
          <stop offset="100%" stop-color="rgba(5,7,10,0.22)" />
        </linearGradient>
        <radialGradient id="leftGlow" cx="0.33" cy="0.56" r="0.58">
          <stop offset="0%" stop-color="rgba(223,86,31,${variant.leftGlowOpacity})" />
          <stop offset="42%" stop-color="rgba(223,86,31,${variant.leftGlowOpacity * 0.45})" />
          <stop offset="100%" stop-color="rgba(223,86,31,0)" />
        </radialGradient>
        <radialGradient id="rightGlow" cx="0.76" cy="0.2" r="0.55">
          <stop offset="0%" stop-color="rgba(223,86,31,${variant.rightGlowOpacity})" />
          <stop offset="45%" stop-color="rgba(223,86,31,${variant.rightGlowOpacity * 0.52})" />
          <stop offset="100%" stop-color="rgba(223,86,31,0)" />
        </radialGradient>
        <linearGradient id="speedLine" x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stop-color="rgba(223,86,31,0)" />
          <stop offset="30%" stop-color="rgba(223,86,31,${variant.lineOpacity})" />
          <stop offset="100%" stop-color="rgba(253,255,164,${variant.lineOpacity * 0.8})" />
        </linearGradient>
        <linearGradient id="speedLineSoft" x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stop-color="rgba(223,86,31,0)" />
          <stop offset="32%" stop-color="rgba(223,86,31,${variant.lineBlurOpacity})" />
          <stop offset="100%" stop-color="rgba(123,208,232,${variant.lineBlurOpacity * 0.7})" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="490" height="${HEIGHT}" fill="rgba(3,4,7,0.94)" />
      <rect x="0" y="0" width="536" height="${HEIGHT}" fill="url(#leftScrim)" />
      <ellipse cx="320" cy="344" rx="290" ry="220" fill="url(#leftGlow)" />
      <ellipse cx="912" cy="120" rx="360" ry="232" fill="url(#rightGlow)" />

      <g opacity="0.92">
        <rect x="470" y="138" width="418" height="10" rx="5" fill="url(#speedLineSoft)" transform="rotate(-10 470 138)" />
        <rect x="514" y="168" width="470" height="5" rx="2.5" fill="url(#speedLine)" transform="rotate(-10 514 168)" />
        <rect x="548" y="210" width="390" height="6" rx="3" fill="url(#speedLineSoft)" transform="rotate(-10 548 210)" />
        <rect x="590" y="520" width="270" height="5" rx="2.5" fill="url(#speedLine)" transform="rotate(-8 590 520)" />
      </g>

      <g transform="translate(62 71)">
        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" transform="translate(0 2) scale(1.55)" fill="#DF561F" />
        <text
          x="50"
          y="24"
          fill="#F4F4F4"
          font-family="'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace"
          font-size="34"
          font-weight="700"
          letter-spacing="4"
        >STRAUDE</text>
      </g>

      <g transform="translate(62 0)">
        <text
          x="0"
          y="254"
          fill="#F5F5F5"
          font-family="'Avenir Next Condensed', 'Helvetica Neue', Inter, sans-serif"
          font-size="84"
          font-weight="700"
          letter-spacing="-3"
          transform="scale(0.66 1)"
        >Strava for</text>
        <text
          x="0"
          y="336"
          fill="#F5F5F5"
          font-family="'Avenir Next Condensed', 'Helvetica Neue', Inter, sans-serif"
          font-size="92"
          font-weight="700"
          letter-spacing="-3.4"
          transform="scale(0.66 1)"
        >Claude Code</text>
      </g>

      <rect x="62" y="370" width="112" height="4" rx="2" fill="#DF561F" />
      <rect x="182" y="370" width="34" height="4" rx="2" fill="rgba(223,86,31,0.42)" />

      <text
        x="64"
        y="592"
        fill="rgba(255,255,255,0.54)"
        font-family="'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace"
        font-size="18"
        font-weight="500"
        letter-spacing="0.2"
      >straude.com</text>

      <rect x="520" y="275" width="340" height="34" rx="10" fill="rgba(10,14,21,0.94)" />
      <text
        x="531"
        y="299"
        fill="rgba(213,219,229,0.88)"
        font-family="Inter"
        font-size="18"
        font-weight="500"
        letter-spacing="-0.2"
      >2.2k LoC modified | Claude Code: 45m session</text>

      <rect x="520" y="317" width="342" height="38" rx="10" fill="rgba(10,14,21,0.96)" />
      <text
        x="531"
        y="344"
        fill="#DF561F"
        font-family="Inter"
        font-size="18"
        font-weight="500"
        letter-spacing="-0.2"
      >Total Tokens: 4.9M tok ($121 spend)</text>

      <rect x="540" y="594" width="330" height="34" rx="10" fill="rgba(10,14,21,0.96)" />
      <text
        x="552"
        y="618"
        fill="#DF561F"
        font-family="Inter"
        font-size="18"
        font-weight="500"
        letter-spacing="-0.2"
      >Total Tokens: 4.2M tok ($97 spend)</text>
    </svg>
  `);
}

async function ensureCleanOutputDir() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(FINAL_DIR, { recursive: true });
}

async function renderVariant(
  variant: VariantConfig,
  baseImage: Buffer,
  surgeImage: Buffer,
  interBold: Buffer,
  interMedium: Buffer,
): Promise<ManifestEntry> {
  const extractLeft = Math.max(0, -variant.heroLeft);
  const extractTop = Math.max(0, -variant.heroTop);
  const resizedWidth = Math.max(variant.heroWidth, WIDTH + extractLeft);
  const resizedHeight = Math.max(variant.heroHeight, HEIGHT + extractTop);
  const surgeLayer = await sharp(surgeImage)
    .resize(resizedWidth, resizedHeight, { fit: "cover" })
    .extract({ left: extractLeft, top: extractTop, width: WIDTH, height: HEIGHT })
    .ensureAlpha(variant.heroOpacity)
    .png()
    .toBuffer();

  const overlay = buildOverlaySvg(variant, interBold, interMedium);
  const finalPath = join(FINAL_DIR, `${variant.id}.png`);

  await sharp(baseImage)
    .composite([
      { input: surgeLayer, left: 0, top: 0, blend: "screen" },
      { input: overlay, left: 0, top: 0, blend: "over" },
    ])
    .png()
    .toFile(finalPath);

  return {
    ...variant,
    finalPath,
  };
}

async function writeContactSheet(entries: ManifestEntry[]) {
  const thumbWidth = 560;
  const thumbHeight = 294;
  const padding = 28;
  const headerHeight = 120;
  const sheetWidth = padding * 3 + thumbWidth * 2;
  const sheetHeight = headerHeight + thumbHeight + padding * 2;

  const base = sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: "#050505",
    },
  });

  const composite: { input: Buffer; top: number; left: number }[] = [
    {
      input: Buffer.from(`
        <svg width="${sheetWidth}" height="${sheetHeight}" xmlns="http://www.w3.org/2000/svg">
          <text x="32" y="46" fill="#F3F3F3" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="700">Straude Athletic Surge Refinements</text>
          <text x="32" y="82" fill="rgba(255,255,255,0.60)" font-size="18" font-family="Arial, Helvetica, sans-serif">Landing-style mono logo, condensed headline, corrected LoC and spend values, and stronger motion energy.</text>
        </svg>
      `),
      top: 0,
      left: 0,
    },
  ];

  for (const [index, entry] of entries.entries()) {
    const left = padding + index * (thumbWidth + padding);
    const top = headerHeight;
    const thumbnail = await sharp(entry.finalPath)
      .resize(thumbWidth, thumbHeight, { fit: "cover" })
      .png()
      .toBuffer();

    composite.push(
      {
        input: thumbnail,
        top,
        left,
      },
      {
        input: Buffer.from(`
          <svg width="${thumbWidth}" height="44" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="${thumbWidth}" height="44" rx="12" fill="rgba(0,0,0,0.76)" />
            <text x="16" y="28" fill="#F3F3F3" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(entry.label)}</text>
          </svg>
        `),
        top: top + thumbHeight - 54,
        left: left + 12,
      },
    );
  }

  await base.composite(composite).png().toFile(CONTACT_SHEET_PATH);
}

async function main() {
  const [baseImage, surgeImage, interBold, interMedium] = await Promise.all([
    readFile(BASE_IMAGE_PATH),
    readFile(SURGE_IMAGE_PATH),
    readFile(INTER_BOLD_PATH),
    readFile(INTER_MEDIUM_PATH),
  ]);

  await ensureCleanOutputDir();

  const entries: ManifestEntry[] = [];
  for (const variant of VARIANTS) {
    entries.push(await renderVariant(variant, baseImage, surgeImage, interBold, interMedium));
  }

  await writeContactSheet(entries);

  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        batchId: BATCH_ID,
        sourceImage: BASE_IMAGE_PATH,
        surgeImage: SURGE_IMAGE_PATH,
        variants: entries,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Wrote ${entries.length} athletic OG refinements to ${FINAL_DIR}`);
}

await main();
