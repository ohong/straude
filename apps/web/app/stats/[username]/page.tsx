import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/service";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const title = `@${username}'s Stats — Straude`;
  const description = `See @${username}'s Claude Code stats on Straude.`;
  const pageUrl = `/stats/${username}`;

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "profile",
    },
    twitter: {
      title,
      description,
      card: "summary_large_image",
    },
  };
}

export default async function StatsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("users")
    .select("username, display_name, is_public")
    .eq("username", username)
    .single();

  if (!profile?.username || !profile.is_public) {
    notFound();
  }

  const imageUrl = `/api/stats/${profile.username}/image`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8efe5] px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8B6B57]">
            Straude Stats
          </p>
          <h1
            className="mt-3 text-3xl font-semibold text-[#1f1a16] sm:text-4xl"
            style={{ letterSpacing: "-0.04em" }}
          >
            {profile.display_name?.trim() || `@${profile.username}`}
          </h1>
          <p className="mt-2 text-sm text-[#705D4F] sm:text-base">
            52 weeks of Claude Code usage. Tracked, visualized, shareable.
          </p>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-[#d9c3af] bg-white/70 shadow-[0_20px_80px_rgba(92,48,21,0.10)]">
          <Image
            src={imageUrl}
            alt={`@${profile.username}'s stats card`}
            width={1200}
            height={630}
            className="h-auto w-full"
            priority
            unoptimized
          />
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="max-w-2xl text-sm text-[#705D4F]">
            Track your Claude Code usage, publish your best sessions, and build
            a streak people can actually see.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-[#DF561F] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Join Straude
          </Link>
        </div>
      </div>
    </main>
  );
}
