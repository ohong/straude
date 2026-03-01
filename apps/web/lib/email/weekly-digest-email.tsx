import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Text,
  Button,
  Hr,
  Link,
  Section,
  Tailwind,
  pixelBasedPreset,
} from "@react-email/components";

interface LeaderboardEntry {
  rank: number;
  username: string;
  spend: string;
}

interface WeeklyDigestEmailProps {
  username: string;
  leaderboard: LeaderboardEntry[];
  leaderboardUrl: string;
  unsubscribeUrl: string;
}

export default function WeeklyDigestEmail({
  username,
  leaderboard,
  leaderboardUrl,
  unsubscribeUrl,
}: WeeklyDigestEmailProps) {
  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                brand: "#DF561F",
              },
            },
          },
        }}
      >
        <Head />
        <Preview>Here&apos;s what happened on Straude this week.</Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="max-w-lg mx-auto bg-white rounded border border-solid border-gray-200">
            <Section className="px-6 pt-8 pb-6">
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-4">
                Hey {username},
              </Text>

              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-4">
                Here&apos;s what happened on Straude this week.
              </Text>

              {/* Leaderboard */}
              <Text className="text-sm font-semibold text-gray-900 m-0 mb-2">
                Top 5 this week
              </Text>
              {leaderboard.map((entry) => (
                <Text
                  key={entry.rank}
                  className="text-sm text-gray-700 leading-relaxed m-0 mb-1"
                >
                  {entry.rank}. {entry.username} — {entry.spend}
                </Text>
              ))}
              <Link
                href={leaderboardUrl}
                className="text-sm text-brand underline"
              >
                View full leaderboard
              </Link>

              <Hr className="border-gray-200 my-6" />

              {/* What's new */}
              <Text className="text-sm font-semibold text-gray-900 m-0 mb-2">
                What&apos;s new
              </Text>
              <Text className="text-sm text-gray-700 leading-relaxed m-0 mb-1">
                &bull; Codex (OpenAI) tracking — log Claude + GPT usage in one
                sync
              </Text>
              <Text className="text-sm text-gray-700 leading-relaxed m-0 mb-1">
                &bull; Achievements &amp; streak freezes — earn badges, protect
                your streak
              </Text>
              <Text className="text-sm text-gray-700 leading-relaxed m-0 mb-4">
                &bull; Public profiles &amp; leaderboard — share your profile,
                compete weekly
              </Text>

              <Hr className="border-gray-200 my-6" />

              {/* CTA */}
              <Section className="bg-gray-900 rounded px-4 py-3 mb-4">
                <Text className="text-sm text-white font-mono m-0">
                  npx straude@latest
                </Text>
              </Section>

              <Text className="text-sm text-gray-600 leading-relaxed m-0 mb-6">
                10 seconds to get on the board.
              </Text>

              <Button
                href={leaderboardUrl}
                className="bg-brand text-white px-6 py-3 rounded text-sm font-semibold no-underline text-center box-border"
              >
                View Leaderboard
              </Button>
            </Section>

            <Hr className="border-gray-200 m-0" />

            <Section className="px-6 py-4">
              <Text className="text-xs text-gray-400 m-0">
                <Link
                  href={unsubscribeUrl}
                  className="text-gray-400 underline"
                >
                  Unsubscribe
                </Link>{" "}
                from email notifications.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

WeeklyDigestEmail.PreviewProps = {
  username: "alice",
  leaderboard: [
    { rank: 1, username: "bob", spend: "$1,234" },
    { rank: 2, username: "carol", spend: "$987" },
    { rank: 3, username: "dave", spend: "$756" },
    { rank: 4, username: "eve", spend: "$543" },
    { rank: 5, username: "frank", spend: "$321" },
  ],
  leaderboardUrl: "https://straude.com/leaderboard",
  unsubscribeUrl: "https://straude.com/api/unsubscribe?token=preview-token",
} satisfies WeeklyDigestEmailProps;
