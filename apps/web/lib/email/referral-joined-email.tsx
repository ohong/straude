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

interface ReferralJoinedEmailProps {
  newUsername: string | null;
  crewCount: number;
  profileUrl: string;
  unsubscribeUrl: string;
}

export default function ReferralJoinedEmail({
  newUsername,
  crewCount,
  profileUrl,
  unsubscribeUrl,
}: ReferralJoinedEmailProps) {
  const who = newUsername ? `@${newUsername}` : "Someone";

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
        <Preview>Your training partner just signed up.</Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="max-w-lg mx-auto bg-white rounded border border-solid border-gray-200">
            <Section className="px-6 pt-8 pb-6">
              <Text className="text-lg font-semibold text-gray-900 m-0 mb-2">
                {who} joined your crew.
              </Text>
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-6">
                {who} just joined Straude through your invite link.
                You now have {crewCount} crew member{crewCount !== 1 ? "s" : ""}.
              </Text>

              {newUsername && (
                <Button
                  href={profileUrl}
                  className="bg-brand text-white px-6 py-3 rounded text-sm font-semibold no-underline text-center box-border"
                >
                  View Their Profile
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

ReferralJoinedEmail.PreviewProps = {
  newUsername: "keon",
  crewCount: 3,
  profileUrl: "https://straude.com/u/keon",
  unsubscribeUrl: "https://straude.com/api/unsubscribe?token=preview-token",
} satisfies ReferralJoinedEmailProps;
