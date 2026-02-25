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

interface WelcomeEmailProps {
  username: string | null;
  profileUrl: string;
  unsubscribeUrl: string;
}

export default function WelcomeEmail({
  username,
  profileUrl,
  unsubscribeUrl,
}: WelcomeEmailProps) {
  const greeting = username ? `Welcome, ${username}.` : "Welcome to Straude.";

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
        <Preview>You're in. Your streak starts at zero.</Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="max-w-lg mx-auto bg-white rounded border border-solid border-gray-200">
            <Section className="px-6 pt-8 pb-6">
              <Text className="text-lg font-semibold text-gray-900 m-0 mb-2">
                {greeting}
              </Text>
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-6">
                Your streak starts at zero. Time to log your first session.
              </Text>

              <Text className="text-sm font-semibold text-gray-900 m-0 mb-2">
                Run this in your terminal:
              </Text>
              <Section className="bg-gray-50 border border-solid border-gray-200 rounded px-4 py-3 mb-2">
                <Text className="text-sm text-gray-900 font-mono m-0">
                  npx straude@latest
                </Text>
              </Section>
              <Text className="text-xs text-gray-500 m-0 mb-6">
                Scans your Claude Code usage and posts it to your profile.
              </Text>

              {username && (
                <Button
                  href={profileUrl}
                  className="bg-brand text-white px-6 py-3 rounded text-sm font-semibold no-underline text-center box-border"
                >
                  View Your Profile
                </Button>
              )}
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

WelcomeEmail.PreviewProps = {
  username: "ohong",
  profileUrl: "https://straude.com/u/ohong",
  unsubscribeUrl: "https://straude.com/api/unsubscribe?token=preview-token",
} satisfies WelcomeEmailProps;
