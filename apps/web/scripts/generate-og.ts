import { fal } from "@fal-ai/client";
import sharp from "sharp";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const MODEL_ID = "fal-ai/nano-banana-2";
const WIDTH = 1200;
const HEIGHT = 630;
const BATCH_ID = "full-ai-product-shots";
const OUTPUT_DIR = resolve(process.cwd(), "og-variants", BATCH_ID);
const FINAL_DIR = join(OUTPUT_DIR, "final");
const MANIFEST_PATH = join(OUTPUT_DIR, "manifest.json");
const CONTACT_SHEET_PATH = join(OUTPUT_DIR, "contact-sheet.png");

type VariantConfig = {
  id: string;
  label: string;
  seed: number;
  prompt: string;
};

type FalImage = {
  url: string;
};

type FalResult = {
  images?: FalImage[];
};

type ManifestEntry = {
  id: string;
  label: string;
  seed: number;
  prompt: string;
  requestId: string | null;
  remoteUrl: string;
  finalPath: string;
};

const BASE_PROMPT = [
  "Create the entire final 1200x630 Open Graph preview image for a web app named Straude.",
  "The image itself must include clearly readable product marketing text spelled exactly as follows: Straude, straude.com, and Strava for Claude Code.",
  "Show larger product shots so a first-time viewer instantly understands the app tracks Claude Code activity, spend, output, pace, and streaks.",
  "Use polished browser-window or app-screen compositions featuring the feed, leaderboard, profile, or weekly stats views.",
  "Keep the composition simpler and less crowded than a collage: one dominant hero product shot plus at most one supporting UI shot.",
  "Make it feel premium, eye-catching, and curiosity-inducing on a fast-moving social timeline.",
  "Brand palette: black, charcoal, burnt orange #DF561F, with optional accents of light blue #7BD0E8 and pale yellow #FDFFA4.",
  "Avoid purple gradients, stock-photo people, busy micro-UI everywhere, unreadable tiny labels, and generic SaaS hero art.",
].join(" ");

const VARIANTS: VariantConfig[] = [
  {
    id: "terminal-feed-poster",
    label: "Terminal Feed Poster",
    seed: 903101,
    prompt: [
      BASE_PROMPT,
      "Style: Straude landing page energy with halftone, dither, subtle ASCII texture, and a cinematic black-and-orange terminal atmosphere.",
      "Use one large straight-on browser window showing the global feed, with one smaller supporting leaderboard panel.",
      "The app name and tagline should be bold and readable, with generous negative space and a premium poster layout.",
    ].join(" "),
  },
  {
    id: "leaderboard-sprint",
    label: "Leaderboard Sprint",
    seed: 903102,
    prompt: [
      BASE_PROMPT,
      "Style: sports-editorial campaign image with clean motion lines and competitive energy.",
      "Make the leaderboard the hero product shot, clearly showing ranks, cost, output, and streak columns.",
      "Add one secondary feed card or weekly summary card to explain the social/productivity angle.",
      "Keep the copy large, sharp, and easy to scan.",
    ].join(" "),
  },
  {
    id: "feed-social-proof",
    label: "Feed Social Proof",
    seed: 903103,
    prompt: [
      BASE_PROMPT,
      "Style: premium product marketing shot with softer depth, glowing orange highlights, and a little editorial polish.",
      "Make the feed the dominant product shot, showing a few activity cards, reactions, comments, and spend or token stats.",
      "Use one secondary leaderboard or streak card so the image communicates both social proof and measurable progress.",
      "Do not overfill the frame with too many windows.",
    ].join(" "),
  },
  {
    id: "profile-streak-board",
    label: "Profile Streak Board",
    seed: 903104,
    prompt: [
      BASE_PROMPT,
      "Style: refined magazine cover meets performance dashboard.",
      "Show a strong profile or personal progress view with weekly totals, streaks, token counts, and a contribution-style graph or stat blocks.",
      "Include one supporting leaderboard or feed shot in the background so the product still reads as social and competitive.",
      "Keep the overall frame calm, spacious, and premium.",
    ].join(" "),
  },
  {
    id: "browser-launch-collage",
    label: "Browser Launch Collage",
    seed: 903105,
    prompt: [
      BASE_PROMPT,
      "Style: glossy launch-campaign image with one hero browser window and one secondary floating product shot, clean depth, and rich orange-black contrast.",
      "Show both the feed and leaderboard in a way that feels aspirational and valuable, not cramped.",
      "The text should feel like a real launch image, with Straude, straude.com, and Strava for Claude Code all visibly readable.",
      "Prioritize clarity over decorative effects.",
    ].join(" "),
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

async function ensureCleanOutputDir() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(FINAL_DIR, { recursive: true });
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download generated image: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function writeVariantImage(variant: VariantConfig): Promise<ManifestEntry> {
  console.log(`Generating ${variant.id} with seed ${variant.seed}...`);

  const response = await fal.subscribe(MODEL_ID, {
    input: {
      prompt: variant.prompt,
      seed: variant.seed,
      aspect_ratio: "16:9",
      resolution: "2K",
      output_format: "png",
      num_images: 1,
    },
    logs: true,
  });

  const data = response.data as FalResult;
  const image = data.images?.[0];
  if (!image?.url) {
    throw new Error(`Model response for ${variant.id} did not include an image URL`);
  }

  const finalBuffer = await sharp(await downloadImage(image.url))
    .resize(WIDTH, HEIGHT, { fit: "cover", position: sharp.strategy.attention })
    .png()
    .toBuffer();

  const finalPath = join(FINAL_DIR, `${variant.id}.png`);
  await writeFile(finalPath, finalBuffer);

  return {
    id: variant.id,
    label: variant.label,
    seed: variant.seed,
    prompt: variant.prompt,
    requestId: response.requestId ?? null,
    remoteUrl: image.url,
    finalPath,
  };
}

async function writeContactSheet(entries: ManifestEntry[]) {
  const thumbWidth = 560;
  const thumbHeight = 294;
  const padding = 28;
  const headerHeight = 120;
  const cols = 2;
  const rows = Math.ceil(entries.length / cols);
  const sheetWidth = padding * 3 + thumbWidth * cols;
  const sheetHeight = headerHeight + padding * (rows + 1) + thumbHeight * rows;

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
          <text x="32" y="46" fill="#F3F3F3" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="700">Straude Full-AI OG Candidates</text>
          <text x="32" y="82" fill="rgba(255,255,255,0.60)" font-size="18" font-family="Arial, Helvetica, sans-serif">Five pure nano-banana product-shot directions.</text>
        </svg>
      `),
      top: 0,
      left: 0,
    },
  ];

  for (const [index, entry] of entries.entries()) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const left = padding + col * (thumbWidth + padding);
    const top = headerHeight + padding + row * (thumbHeight + padding);
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
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    throw new Error("Missing FAL_KEY in environment. Add it to apps/web/.env.local before running.");
  }

  fal.config({ credentials: apiKey });

  await ensureCleanOutputDir();

  const entries: ManifestEntry[] = [];
  for (const variant of VARIANTS) {
    entries.push(await writeVariantImage(variant));
  }

  await writeContactSheet(entries);

  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        batchId: BATCH_ID,
        mode: "full-ai",
        model: MODEL_ID,
        outputDir: OUTPUT_DIR,
        contactSheetPath: CONTACT_SHEET_PATH,
        variants: entries,
        notes: [
          "These images are fully generated by nano-banana with no deterministic overlay step.",
          "Prompts ask for larger product shots so the feed, leaderboard, and profile value are legible at a glance.",
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Generated ${entries.length} OG candidates in ${OUTPUT_DIR}`);
  console.log(`Contact sheet: ${CONTACT_SHEET_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
