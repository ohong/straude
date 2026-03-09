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

interface ReactivationEmailProps {
  unsubscribeUrl: string;
}

export default function ReactivationEmail({
  unsubscribeUrl,
}: ReactivationEmailProps) {
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
        <Preview>We fixed a bug that blocked your signup. Your account is ready.</Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="max-w-lg mx-auto bg-white rounded border border-solid border-gray-200">
            <Section className="px-6 pt-8 pb-6">
              <Text className="text-lg font-semibold text-gray-900 m-0 mb-2">
                We owe you an apology.
              </Text>
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-4">
                When you signed up for Straude, a bug on our end prevented your
                account from being set up correctly. You may have seen errors or
                been unable to complete onboarding.
              </Text>
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-4">
                This was entirely our fault, and we're sorry for the frustrating
                experience. The issue has been fixed.
              </Text>
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-6">
                Your account is now ready. Log in to pick your username and start
                tracking your Claude Code usage.
              </Text>

              <Button
                href="https://straude.com/onboarding"
                className="bg-brand text-white px-6 py-3 rounded text-sm font-semibold no-underline text-center box-border"
              >
                Complete Your Setup
              </Button>

              <Text className="text-sm text-gray-500 leading-relaxed m-0 mt-6">
                Once you're set up, run this in your terminal to log your first
                session:
              </Text>
              <Section className="bg-gray-50 border border-solid border-gray-200 rounded px-4 py-3 mt-2">
                <Text className="text-sm text-gray-900 font-mono m-0">
                  npx straude@latest
                </Text>
              </Section>
            </Section>

            <Hr className="border-gray-200 m-0" />

            <Section className="px-6 py-4">
              <Text className="text-xs text-gray-400 m-0">
                If you have any questions, reply to this email — it goes
                straight to the team.
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

ReactivationEmail.PreviewProps = {
  unsubscribeUrl: "https://straude.com/api/unsubscribe?token=preview-token",
} satisfies ReactivationEmailProps;
