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

interface NudgeEmailProps {
  username: string;
  profileUrl: string;
  unsubscribeUrl: string;
}

export default function NudgeEmail({
  username,
  profileUrl,
  unsubscribeUrl,
}: NudgeEmailProps) {
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
        <Preview>
          You signed up for Straude but haven&apos;t logged a session yet.
        </Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="max-w-lg mx-auto bg-white rounded border border-solid border-gray-200">
            <Section className="px-6 pt-8 pb-6">
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-4">
                Hey {username},
              </Text>

              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-4">
                You signed up for Straude yesterday but haven&apos;t logged a
                session yet. Every streak starts with day one. One command gets
                you on the board:
              </Text>

              <Section className="bg-gray-900 rounded px-4 py-3 mb-6">
                <Text className="text-sm text-white font-mono m-0">
                  npx straude@latest
                </Text>
              </Section>

              <Text className="text-sm text-gray-600 leading-relaxed m-0 mb-6">
                Run it wherever you use Claude Code. It takes about 10 seconds.
              </Text>

              <Button
                href={profileUrl}
                className="bg-brand text-white px-6 py-3 rounded text-sm font-semibold no-underline text-center box-border"
              >
                View Your Profile
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

NudgeEmail.PreviewProps = {
  username: "alice",
  profileUrl: "https://straude.com/u/alice",
  unsubscribeUrl: "https://straude.com/api/unsubscribe?token=preview-token",
} satisfies NudgeEmailProps;
