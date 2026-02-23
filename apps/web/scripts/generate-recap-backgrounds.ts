#!/usr/bin/env bun
/**
 * One-shot script to generate 10 recap background images via FLUX API.
 *
 * Usage:
 *   BFL_API_KEY=your_key bun run apps/web/scripts/generate-recap-backgrounds.ts
 *
 * Outputs 1080x1080 JPGs to apps/web/public/recap-bg/01.jpg through 10.jpg.
 */

import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const API_KEY = process.env.BFL_API_KEY;
if (!API_KEY) {
  console.error("Missing BFL_API_KEY environment variable");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../public/recap-bg");

const PROMPTS = [
  "Abstract golden sunrise gradient with soft light streaks and warm atmospheric glow, bright and airy, no text no people no objects, pure ambient light painting",
  "Warm amber and white abstract brushstrokes with flowing texture, soft creamy highlights and gentle warmth, no text no people no objects, pure ambient light painting",
  "Soft peach and coral aurora with delicate light bokeh circles, warm ethereal atmosphere, no text no people no objects, pure ambient light painting",
  "Cool blue and warm orange sunset gradient wash blending together, atmospheric and dreamy, no text no people no objects, pure ambient light painting",
  "Ethereal white and gold mist with warm light leaks, bright and luminous abstract atmosphere, no text no people no objects, pure ambient light painting",
  "Warm terracotta and cream flowing gradients, earthy yet bright abstract atmosphere, no text no people no objects, pure ambient light painting",
  "Soft lavender and peach atmospheric blur with gentle pastel transitions, dreamy and light, no text no people no objects, pure ambient light painting",
  "Dynamic orange and white energy streaks with flowing abstract motion, bright and vibrant, no text no people no objects, pure ambient light painting",
  "Misty morning atmosphere with golden light rays breaking through, bright and hopeful, no text no people no objects, pure ambient light painting",
  "Abstract warm gradient with subtle geometric texture overlay, modern and refined, no text no people no objects, pure ambient light painting",
];

async function generateImage(prompt: string, index: number): Promise<void> {
  const id = String(index + 1).padStart(2, "0");
  const outPath = join(OUT_DIR, `${id}.jpg`);

  console.log(`[${id}] Submitting generation request...`);

  // Step 1: Submit generation
  const submitRes = await fetch("https://api.bfl.ai/v1/flux-2-pro", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-key": API_KEY!,
    },
    body: JSON.stringify({
      prompt,
      width: 1080,
      height: 1080,
      output_format: "jpeg",
    }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`[${id}] Submit failed (${submitRes.status}): ${text}`);
  }

  const { id: taskId, polling_url } = (await submitRes.json()) as {
    id: string;
    polling_url: string;
  };

  console.log(`[${id}] Task ${taskId} — polling...`);

  // Step 2: Poll until ready
  let sampleUrl: string | null = null;
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetch(polling_url, {
      headers: { "x-key": API_KEY! },
    });
    const poll = (await pollRes.json()) as {
      status: string;
      result?: { sample: string };
    };

    if (poll.status === "Ready" && poll.result?.sample) {
      sampleUrl = poll.result.sample;
      break;
    }
    if (poll.status === "Error") {
      throw new Error(`[${id}] Generation failed`);
    }
  }

  if (!sampleUrl) {
    throw new Error(`[${id}] Timed out waiting for generation`);
  }

  // Step 3: Download and save
  console.log(`[${id}] Downloading...`);
  const imgRes = await fetch(sampleUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  await writeFile(outPath, buffer);
  console.log(`[${id}] Saved to ${outPath}`);
}

async function main() {
  // Generate sequentially to avoid rate limits
  for (let i = 0; i < PROMPTS.length; i++) {
    await generateImage(PROMPTS[i], i);
  }
  console.log("Done! All 10 backgrounds generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
