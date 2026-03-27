"use client";

import { ProfileShareCardImage } from "@/lib/share-assets/profile-card-image";
import { ShareCardImage } from "@/lib/utils/share-image";
import { ProfileSharePanel } from "@/components/app/profile/ProfileSharePanel";
import { PostSharePanel } from "@/components/app/post/PostSharePanel";
import type { ProfileShareCardData } from "@/lib/share-assets/profile-card-data";

const SAMPLE_PROFILE: ProfileShareCardData = {
  username: "mark",
  display_name: "Mark Morgan",
  is_public: true,
  streak: 118,
  total_output_tokens: 2_020_000_000,
  recent_output_tokens: 164_000_000,
  active_days_last_30: 26,
  primary_model: "GPT-5.3-Codex",
  contribution_data: Array.from({ length: 365 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (364 - index));
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const intensity = index % 17 === 0 ? 132 : index % 7 === 0 ? 74 : index % 3 === 0 ? 28 : index % 2 === 0 ? 8 : 0;
    return { date: iso, cost_usd: intensity };
  }),
};

const SAMPLE_POST = {
  id: "post-demo",
  title: "Tightened the share flow and stopped hiding the best card in a dropdown.",
  description:
    "Shipped a new session card, wired visible share URLs into the post page, and made the profile consistency asset feel more like a training log than a screenshot.",
  images: [],
  username: "mark",
  avatar_url: null,
  cost_usd: 47.87,
  input_tokens: 12_000_000,
  output_tokens: 42_300_000,
  models: ["gpt-5.3-codex", "claude-opus-4-20250514"],
  is_verified: true,
};

const PANEL_IMAGE_URL = "/qa-share-preview.svg";

export default function ShareAssetsPreviewPage() {
  return (
    <div className="min-h-screen bg-[#f6ede4] px-6 py-10">
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

      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8B6B57]">
            Share Asset Preview
          </p>
          <h1
            className="mt-3 text-4xl font-semibold text-[#1f1a16]"
            style={{ letterSpacing: "-0.04em" }}
          >
            Manual QA Harness
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[#705D4F]">
            This route exists only to verify the new cards and inline share
            panels in a browser when the local machine does not have Supabase
            credentials loaded.
          </p>
        </div>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-[#1f1a16]">
            Stats Card
          </h2>
          <div className="overflow-hidden rounded-[28px] border border-[#d9c3af] bg-white shadow-[0_20px_80px_rgba(92,48,21,0.10)]">
            <div
              style={{
                width: 1200,
                height: 630,
                transform: "scale(0.82)",
                transformOrigin: "top left",
                marginBottom: "-112px",
              }}
            >
              <ProfileShareCardImage data={SAMPLE_PROFILE} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-[#1f1a16]">
            Session Card
          </h2>
          <div className="overflow-hidden rounded-[28px] border border-[#d9c3af] bg-white shadow-[0_20px_80px_rgba(92,48,21,0.10)]">
            <div
              style={{
                width: 1200,
                height: 630,
                transform: "scale(0.82)",
                transformOrigin: "top left",
                marginBottom: "-112px",
              }}
            >
              <ShareCardImage post={SAMPLE_POST} themeId="accent" />
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-[#1f1a16]">
              Profile Share Panel
            </h2>
            <ProfileSharePanel
              username="mark"
              isPublic
              isOwner
              shareUrlOverride="https://straude.com/stats/mark"
              imageUrlOverride={PANEL_IMAGE_URL}
              downloadUrlOverride={PANEL_IMAGE_URL}
            />
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-[#1f1a16]">
              Post Share Panel
            </h2>
            <PostSharePanel
              postId="post-demo"
              sharePost={{
                id: SAMPLE_POST.id,
                title: SAMPLE_POST.title,
                images: SAMPLE_POST.images,
                user: { username: SAMPLE_POST.username },
                daily_usage: {
                  cost_usd: SAMPLE_POST.cost_usd,
                  output_tokens: SAMPLE_POST.output_tokens,
                  models: SAMPLE_POST.models,
                  is_verified: SAMPLE_POST.is_verified,
                },
              }}
              shareUrlOverride="https://straude.com/post/post-demo"
              imageUrlOverride={PANEL_IMAGE_URL}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
