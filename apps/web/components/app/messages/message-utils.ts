import type { DirectMessage, DirectMessageThread } from "@/types";

export interface PendingAttachment {
  file: File;
  preview?: string;
  uploading: boolean;
}

export type DeliveryStatus = "sending" | "sent" | "failed";

export type LocalDirectMessage = DirectMessage & {
  delivery_status?: DeliveryStatus;
};

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(type: string, fileName?: string): boolean {
  if (type.startsWith("image/")) return true;
  if (!fileName) return false;
  const ext = fileName.split(".").pop()?.toLowerCase();
  return !!ext && IMAGE_EXTENSIONS.includes(ext);
}

export function createPendingAttachment(file: File): PendingAttachment {
  const preview = isImageMime(file.type, file.name)
    ? URL.createObjectURL(file)
    : undefined;
  return { file, preview, uploading: false };
}

export function threadPreview(thread: DirectMessageThread): string {
  const prefix = thread.last_message_is_from_me ? "You: " : "";
  if (thread.last_message_content) {
    return `${prefix}${thread.last_message_content}`;
  }
  if (thread.last_message_has_attachment) {
    return `${prefix}Sent an attachment`;
  }
  return "";
}
