import { fal } from "@fal-ai/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const MODEL_ID = "fal-ai/nano-banana-2/edit";
const WIDTH = 1200;
const HEIGHT = 630;
const BATCH_ID = "feed-social-proof-real-users";
const OUTPUT_DIR = resolve(process.cwd(), "og-variants", BATCH_ID);
const FINAL_DIR = join(OUTPUT_DIR, "final");
const MANIFEST_PATH = join(OUTPUT_DIR, "manifest.json");
const CONTACT_SHEET_PATH = join(OUTPUT_DIR, "contact-sheet.png");
const BASE_IMAGE_PATH = resolve(
  process.cwd(),
  "og-variants",
  "full-ai-product-shots",
  "final",
  "feed-social-proof.png",
);

type LeaderUser = {
  user_id: string;
  username: string;
  avatar_url: string;
  total_cost: number;
  total_output_tokens: number;
  streak: number;
  spendTarget: number;
  tokLabel: string;
};

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
  description?: string;
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

function formatMillions(tokens: number): string {
  return `${(tokens / 1_000_000).toFixed(1)}M tok`;
}

function buildSpendTarget(totalCost: number): number {
  return Math.max(250, Math.round(totalCost / 2));
}

function userSummary(user: LeaderUser, rank: number): string {
  const streakLabel = user.streak > 0 ? `${user.streak}d streak` : "no streak badge";
  return `${rank}. ${user.username} using avatar reference ${rank + 1}, show ${user.tokLabel}, ${streakLabel}, and a spend figure around $${user.spendTarget}`;
}

function buildVariantPrompt(users: [LeaderUser, LeaderUser, LeaderUser], flavor: string): string {
  const [first, second, third] = users;
  return [
    "Edit the first reference image and keep its overall composition, atmosphere, dark glassmorphism, and spacious left-text / right-product layout.",
    "The next three reference images are the real avatar references for the top 3 Straude users. Use those real faces, not stock portraits, and match them to the correct usernames.",
    "Replace the fake people and fake names with these exact leaderboard users:",
    userSummary(first, 1),
    userSummary(second, 2),
    userSummary(third, 3),
    `Use clearly readable text spelled exactly as: Straude, straude.com, and Strava for Claude Code.`,
    `The main activity card should feature ${first.username} with the real avatar from reference image 2.`,
    `The smaller supporting activity should feature either ${second.username} or ${third.username}, using the matching avatar reference.`,
    `Every spend amount shown in activity cards should be in the hundreds of dollars, not single digits. Use values like $${first.spendTarget}, $${second.spendTarget}, and $${third.spendTarget}.`,
    `On the leaderboard, never show 'tokens/min'. Use only 'tok'. The visible token labels should be million-scale, specifically ${first.tokLabel}, ${second.tokLabel}, and ${third.tokLabel}.`,
    "Do not add any extra fake users, do not invent generic headshots, and do not shrink the product UI into unreadable tiny widgets.",
    "Keep the image elegant, premium, and uncluttered.",
    flavor,
  ].join(" ");
}

const VARIANT_FLAVORS = [
  "Stay extremely close to the current chosen image, with only the people, names, spend values, and tok labels updated.",
  "Make the leaderboard card a little crisper and easier to scan while preserving the same overall composition.",
  "Keep the same layout but make the UI text sharper and the user identity details more legible at social-preview scale.",
] as const;

async function ensureCleanOutputDir() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(FINAL_DIR, { recursive: true });
}

async function fetchTopUsers(): Promise<[LeaderUser, LeaderUser, LeaderUser]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecret) {
    throw new Error("Missing Supabase env vars. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: { persistSession: false },
  });

  const { data: leaderboard, error: leaderboardError } = await supabase
    .from("leaderboard_weekly")
    .select("user_id, username, avatar_url, total_cost, total_output_tokens")
    .order("total_cost", { ascending: false })
    .limit(3);

  if (leaderboardError) {
    throw new Error(`Failed to fetch leaderboard users: ${leaderboardError.message}`);
  }

  if (!leaderboard || leaderboard.length < 3) {
    throw new Error("Expected at least three leaderboard users.");
  }

  const userIds = leaderboard.map((entry) => entry.user_id);
  const { data: streakRows, error: streakError } = await supabase.rpc(
    "calculate_streaks_batch",
    { p_user_ids: userIds },
  );

  if (streakError) {
    throw new Error(`Failed to fetch streaks: ${streakError.message}`);
  }

  const streakMap = new Map<string, number>();
  for (const row of streakRows ?? []) {
    streakMap.set(row.user_id, row.streak);
  }

  return leaderboard.map((entry) => ({
    ...entry,
    streak: streakMap.get(entry.user_id) ?? 0,
    spendTarget: buildSpendTarget(entry.total_cost),
    tokLabel: formatMillions(entry.total_output_tokens),
  })) as [LeaderUser, LeaderUser, LeaderUser];
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function uploadBuffer(name: string, buffer: Buffer, type: string): Promise<string> {
  const file = new File([new Uint8Array(buffer)], name, { type });
  return fal.storage.upload(file);
}

async function prepareReferenceUrls(users: [LeaderUser, LeaderUser, LeaderUser]) {
  const baseBuffer = await readFile(BASE_IMAGE_PATH);
  const [avatarOne, avatarTwo, avatarThree] = await Promise.all(
    users.map((user) => fetchBuffer(user.avatar_url)),
  );

  const [baseImageUrl, avatarOneUrl, avatarTwoUrl, avatarThreeUrl] = await Promise.all([
    uploadBuffer(basename(BASE_IMAGE_PATH), baseBuffer, "image/png"),
    uploadBuffer(`${users[0].username}.png`, avatarOne, "image/png"),
    uploadBuffer(`${users[1].username}.png`, avatarTwo, "image/png"),
    uploadBuffer(`${users[2].username}.png`, avatarThree, "image/png"),
  ]);

  return {
    baseImageUrl,
    avatarUrls: [avatarOneUrl, avatarTwoUrl, avatarThreeUrl],
  };
}

async function writeVariant(
  variant: VariantConfig,
  imageUrls: string[],
): Promise<ManifestEntry> {
  console.log(`Generating ${variant.id} with seed ${variant.seed}...`);

  const response = await fal.subscribe(MODEL_ID, {
    input: {
      prompt: variant.prompt,
      image_urls: imageUrls,
      seed: variant.seed,
      aspect_ratio: "16:9",
      output_format: "png",
      num_images: 1,
      limit_generations: true,
    },
    logs: true,
  });

  const data = response.data as FalResult;
  const image = data.images?.[0];
  if (!image?.url) {
    throw new Error(`Model response for ${variant.id} did not include an image URL`);
  }

  const finalPath = join(FINAL_DIR, `${variant.id}.png`);
  const finalBuffer = await sharp(await fetchBuffer(image.url))
    .resize(WIDTH, HEIGHT, { fit: "cover", position: sharp.strategy.attention })
    .png()
    .toBuffer();

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
          <text x="32" y="46" fill="#F3F3F3" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="700">Straude Real-User Refinements</text>
          <text x="32" y="82" fill="rgba(255,255,255,0.60)" font-size="18" font-family="Arial, Helvetica, sans-serif">Edited from the chosen feed-social-proof card using real top-3 avatars and million-scale tok labels.</text>
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
            <text x="16" y="28" fill="#F3F3F3" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="700">${entry.label}</text>
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
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new Error("Missing FAL_KEY in environment.");
  }

  fal.config({ credentials: falKey });

  await ensureCleanOutputDir();

  const users = await fetchTopUsers();
  const referenceUrls = await prepareReferenceUrls(users);
  const imageUrls = [referenceUrls.baseImageUrl, ...referenceUrls.avatarUrls];

  const variants: VariantConfig[] = VARIANT_FLAVORS.map((flavor, index) => ({
    id: `real-users-v${index + 1}`,
    label: `Real Users V${index + 1}`,
    seed: 904101 + index,
    prompt: buildVariantPrompt(users, flavor),
  }));

  const entries: ManifestEntry[] = [];
  for (const variant of variants) {
    entries.push(await writeVariant(variant, imageUrls));
  }

  await writeContactSheet(entries);

  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        batchId: BATCH_ID,
        baseImagePath: BASE_IMAGE_PATH,
        model: MODEL_ID,
        outputDir: OUTPUT_DIR,
        contactSheetPath: CONTACT_SHEET_PATH,
        topUsers: users,
        variants: entries,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Generated ${entries.length} refined OG candidates in ${OUTPUT_DIR}`);
  console.log(`Contact sheet: ${CONTACT_SHEET_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
