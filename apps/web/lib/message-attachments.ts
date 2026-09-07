import { getServiceClient } from "@/lib/supabase/service";
import {
  isStoragePathOwnedByUser,
  normalizeMessageAttachmentInput,
} from "@/lib/storage";
import type { MessageAttachment, MessageAttachmentInput } from "@/types";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function buildSignedMessageAttachments(
  rawAttachments: unknown,
  expectedOwnerId?: string,
): Promise<MessageAttachment[]> {
  const [signed] = await buildSignedMessageAttachmentBatches([
    { rawAttachments, expectedOwnerId },
  ]);
  return signed ?? [];
}

export async function buildSignedMessageAttachmentBatches(
  groups: Array<{ rawAttachments: unknown; expectedOwnerId?: string }>,
): Promise<MessageAttachment[][]> {
  const normalizedGroups = groups.map(({ rawAttachments, expectedOwnerId }) =>
    Array.isArray(rawAttachments)
      ? rawAttachments
          .map(normalizeMessageAttachmentInput)
          .filter((attachment): attachment is MessageAttachmentInput => {
            if (attachment === null) return false;
            return expectedOwnerId
              ? isStoragePathOwnedByUser(attachment.path, expectedOwnerId)
              : true;
          })
      : [],
  );
  const attachments = normalizedGroups.flat();

  if (attachments.length === 0) return groups.map(() => []);

  const db = getServiceClient();
  const byBucket = new Map<string, MessageAttachmentInput[]>();
  for (const attachment of attachments) {
    const bucketAttachments = byBucket.get(attachment.bucket) ?? [];
    bucketAttachments.push(attachment);
    byBucket.set(attachment.bucket, bucketAttachments);
  }

  const signedByBucketAndPath = new Map<string, string>();
  await Promise.all(
    [...byBucket].map(async ([bucket, bucketAttachments]) => {
      const { data, error } = await db.storage
        .from(bucket)
        .createSignedUrls(
          bucketAttachments.map((attachment) => attachment.path),
          SIGNED_URL_TTL_SECONDS,
        );

      if (error) {
        console.error("[messages] failed to sign DM attachments:", error.message);
        return;
      }

      for (const signed of data) {
        if (signed.path && signed.signedUrl && !signed.error) {
          signedByBucketAndPath.set(`${bucket}\0${signed.path}`, signed.signedUrl);
        } else if (signed.error) {
          console.error("[messages] failed to sign DM attachment:", signed.error);
        }
      }
    }),
  );

  return normalizedGroups.map((group) =>
    group.flatMap((attachment) => {
      const url = signedByBucketAndPath.get(
        `${attachment.bucket}\0${attachment.path}`,
      );
      return url ? [{ ...attachment, url }] : [];
    }),
  );
}
