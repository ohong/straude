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

export type NotificationType = "comment" | "mention" | "post_mention";

interface NotificationEmailProps {
  actorUsername: string;
  type: NotificationType;
  content: string;
  postTitle: string | null;
  postUrl: string;
  unsubscribeUrl: string;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function subjectLine(type: NotificationType, actor: string): string {
  switch (type) {
    case "comment":
      return `${actor} commented on your post`;
    case "mention":
      return `${actor} mentioned you in a comment`;
    case "post_mention":
      return `${actor} tagged you in a post`;
  }
}

function previewText(
  type: NotificationType,
  actor: string,
  content: string,
): string {
  const short = truncate(content, 80);
  switch (type) {
    case "comment":
      return `${actor}: "${short}"`;
    case "mention":
      return `${actor} mentioned you: "${short}"`;
    case "post_mention":
      return `${actor} tagged you: "${short}"`;
  }
}

function headline(
  type: NotificationType,
  actor: string,
  postLabel: string,
): string {
  switch (type) {
    case "comment":
      return `${actor} commented on ${postLabel}:`;
    case "mention":
      return `${actor} mentioned you in ${postLabel}:`;
    case "post_mention":
      return `${actor} tagged you in ${postLabel}:`;
  }
}

export function buildSubject(type: NotificationType, actor: string): string {
  return subjectLine(type, actor);
}

export default function NotificationEmail({
  actorUsername,
  type,
  content,
  postTitle,
  postUrl,
  unsubscribeUrl,
}: NotificationEmailProps) {
  const postLabel = postTitle ?? "a post";
  const truncated = truncate(content, 200);
  const preview = previewText(type, actorUsername, content);
  const heading = headline(type, actorUsername, postLabel);

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
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="max-w-lg mx-auto bg-white rounded border border-solid border-gray-200">
            <Section className="px-6 pt-8 pb-6">
              <Text className="text-base text-gray-900 leading-relaxed m-0 mb-4">
                <strong>{actorUsername}</strong>{" "}
                {type === "comment"
                  ? `commented on ${postLabel}:`
                  : type === "post_mention"
                    ? `tagged you in ${postLabel}:`
                    : `mentioned you in ${postLabel}:`}
              </Text>

              <Section className="bg-gray-50 border-l-4 border-solid border-l-brand border-t-0 border-r-0 border-b-0 px-4 py-3 mb-6">
                <Text className="text-sm text-gray-900 leading-relaxed m-0">
                  {truncated}
                </Text>
              </Section>

              <Button
                href={postUrl}
                className="bg-brand text-white px-6 py-3 rounded text-sm font-semibold no-underline text-center box-border"
              >
                View Post
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

NotificationEmail.PreviewProps = {
  actorUsername: "alice",
  type: "comment" as NotificationType,
  content:
    "Great post! I really enjoyed reading about your training session today.",
  postTitle: "Morning 10K",
  postUrl: "https://straude.com/post/abc123",
  unsubscribeUrl: "https://straude.com/api/unsubscribe?token=preview-token",
} satisfies NotificationEmailProps;
