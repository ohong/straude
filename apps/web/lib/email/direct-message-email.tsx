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

interface DirectMessageEmailProps {
  actorUsername: string;
  content: string;
  conversationUrl: string;
  settingsUrl: string;
  unsubscribeUrl: string;
}

function truncate(str: string, max: number) {
  return str.length > max ? `${str.slice(0, max)}...` : str;
}

export function buildDirectMessageSubject(actorUsername: string) {
  return `${actorUsername} sent you a direct message`;
}

export default function DirectMessageEmail({
  actorUsername,
  content,
  conversationUrl,
  settingsUrl,
  unsubscribeUrl,
}: DirectMessageEmailProps) {
  const preview = `${actorUsername}: "${truncate(content, 80)}"`;

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
        <Preview>{preview}</Preview>
        <Body className="bg-gray-100 py-10 font-sans">
          <Container className="mx-auto max-w-lg rounded border border-solid border-gray-200 bg-white">
            <Section className="px-6 pb-6 pt-8">
              <Text className="m-0 mb-4 text-base leading-relaxed text-gray-900">
                <strong>{actorUsername}</strong> sent you a direct message on Straude:
              </Text>

              <Section className="mb-6 border-0 border-l-4 border-solid border-l-brand bg-gray-50 px-4 py-3">
                <Text className="m-0 text-sm leading-relaxed text-gray-900">
                  {truncate(content, 300)}
                </Text>
              </Section>

              <Button
                href={conversationUrl}
                className="box-border rounded bg-brand px-6 py-3 text-center text-sm font-semibold text-white no-underline"
              >
                Open Conversation
              </Button>
            </Section>

            <Hr className="m-0 border-gray-200" />

            <Section className="px-6 py-4">
              <Text className="m-0 text-xs text-gray-400">
                <Link href={settingsUrl} className="text-gray-400 underline">
                  Manage settings
                </Link>{" "}
                or{" "}
                <Link href={unsubscribeUrl} className="text-gray-400 underline">
                  unsubscribe from DM emails
                </Link>
                .
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

DirectMessageEmail.PreviewProps = {
  actorUsername: "alice",
  content: "Loved the work on your latest activity. How did you structure the import flow?",
  conversationUrl: "https://straude.com/messages?with=alice",
  settingsUrl: "https://straude.com/settings",
  unsubscribeUrl: "https://straude.com/api/unsubscribe?token=preview-token&kind=dm",
} satisfies DirectMessageEmailProps;
