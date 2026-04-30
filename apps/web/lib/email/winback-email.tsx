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

interface WinbackEmailProps {
  unsubscribeUrl: string;
}

export default function WinbackEmail({ unsubscribeUrl }: WinbackEmailProps) {
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
          79 devs have logged $44K in Claude Code spend on Straude. You signed
          up but never finished setup.
        </Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="max-w-lg mx-auto bg-white rounded border border-solid border-gray-200">
            <Section className="px-6 pt-8 pb-6">
              <Text className="text-lg font-semibold text-gray-900 m-0 mb-2">
                Remember Straude?
              </Text>
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-4">
                Straude tracks your Claude Code and Codex spend, sessions, and
                streaks — like Strava for AI engineering. You signed up but never
                finished setting up your profile.
              </Text>
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-4">
                Since launch, the community has logged{" "}
                <strong>$44,500+ in API spend</strong> across{" "}
                <strong>815 sessions</strong>. One user{" "}
                <Link
                  href="https://straude.com/post/25c0a07d-90be-46e5-8402-ebfccedb5bb5"
                  className="text-brand underline"
                >
                  burned through a 5-hour session window in 20 minutes
                </Link>
                . Another{" "}
                <Link
                  href="https://straude.com/post/3d31697f-8ecc-4cd7-8703-cb8372e7ab7b"
                  className="text-brand underline"
                >
                  ran $340 worth of Claude Code while he builds LEGOs
                </Link>
                .
              </Text>
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-6">
                Setup takes 30 seconds — pick a username, then run{" "}
                <strong>npx straude@latest</strong> in your terminal.
              </Text>

              <Text className="text-base text-gray-900 font-semibold m-0 mb-4">
                See you on Straude!
              </Text>

              <Button
                href="https://straude.com/onboarding"
                className="bg-brand text-white px-6 py-3 rounded text-sm font-semibold no-underline text-center box-border"
              >
                Finish Setup
              </Button>
            </Section>

            <Hr className="border-gray-200 m-0" />

            <Section className="px-6 py-4">
              <Text className="text-xs text-gray-400 m-0">
                You are getting this because you signed up for Straude but
                have not completed onboarding. Reply to this email if you have
                any questions.
              </Text>
              <Text className="text-xs text-gray-400 m-0 mt-2">
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

WinbackEmail.PreviewProps = {
  unsubscribeUrl: "https://straude.com/api/unsubscribe?token=preview-token",
} satisfies WinbackEmailProps;
