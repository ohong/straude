"use client";

import Image from "next/image";
import { FileText, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/format";
import type { MessageAttachment } from "@/types";
import {
  formatFileSize,
  isImageMime,
  type LocalDirectMessage,
  type PendingAttachment,
} from "./message-utils";

function AttachmentLink({
  attachment,
  mine,
}: {
  attachment: MessageAttachment;
  mine: boolean;
}) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
        mine ? "bg-white/15 hover:bg-white/25" : "bg-subtle hover:bg-subtle/80",
      )}
    >
      <FileText size={16} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{attachment.name}</span>
      <span className={cn("shrink-0 text-xs", mine ? "text-white/70" : "text-muted")}>
        {formatFileSize(attachment.size)}
      </span>
    </a>
  );
}

export function MessageBubble({
  message,
  currentUserId,
  onOpenImage,
}: {
  message: LocalDirectMessage;
  currentUserId: string | null;
  onOpenImage: (url: string) => void;
}) {
  const mine = message.sender_id === currentUserId;
  const attachments = message.attachments ?? [];
  const imageAttachments = attachments.filter((attachment) =>
    isImageMime(attachment.type, attachment.name),
  );
  const fileAttachments = attachments.filter((attachment) =>
    !isImageMime(attachment.type, attachment.name),
  );

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "rounded-2xl px-4 py-3",
          mine ? "bg-accent text-accent-foreground" : "border border-border bg-background",
        )}
        style={{ maxWidth: "var(--app-messages-bubble-max-width)" }}
      >
        {imageAttachments.length > 0 && (
          <div className={cn("flex flex-wrap gap-1.5", message.content && "mb-2")}>
            {imageAttachments.map((attachment) => (
              <button
                key={attachment.url}
                type="button"
                onClick={() => onOpenImage(attachment.url)}
                className="relative block overflow-hidden rounded-lg"
                aria-label={`View ${attachment.name}`}
              >
                <Image
                  src={attachment.url}
                  alt={attachment.name}
                  width={96}
                  height={96}
                  className="h-[var(--app-messages-attachment-size)] w-[var(--app-messages-attachment-size)] rounded-lg object-cover"
                  sizes="(max-width: 879px) 80px, 96px"
                />
              </button>
            ))}
          </div>
        )}

        {fileAttachments.length > 0 && (
          <div className={cn("space-y-1.5", message.content && "mb-2")}>
            {fileAttachments.map((attachment) => (
              <AttachmentLink key={attachment.url} attachment={attachment} mine={mine} />
            ))}
          </div>
        )}

        {message.content && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
        )}

        <div className={cn("mt-2 flex items-center gap-2 text-xs", mine ? "text-white/70" : "text-muted")}>
          <span suppressHydrationWarning>{timeAgo(message.created_at)}</span>
          {mine && message.delivery_status && (
            <span className="capitalize">{message.delivery_status}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PendingAttachmentList({
  attachments,
  onRemove,
}: {
  attachments: PendingAttachment[];
  onRemove: (index: number) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {attachments.map((attachment, index) => (
        <div key={index} className="group relative">
          {attachment.preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.preview}
                alt={attachment.file.name}
                className={cn(
                  "h-[var(--app-messages-attachment-size)] w-[var(--app-messages-attachment-size)] rounded-lg border border-border object-cover",
                  attachment.uploading && "opacity-50",
                )}
              />
              {attachment.uploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-accent" />
                </div>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "flex h-[var(--app-messages-attachment-size)] items-center gap-2 rounded-lg border border-border bg-subtle px-3",
                attachment.uploading && "opacity-50",
              )}
            >
              <FileText size={16} className="shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0">
                <p className="max-w-[120px] truncate text-xs font-medium">
                  {attachment.file.name}
                </p>
                <p className="text-xs text-muted">
                  {formatFileSize(attachment.file.size)}
                </p>
              </div>
              {attachment.uploading && (
                <Loader2 size={14} className="animate-spin text-accent" />
              )}
            </div>
          )}
          {!attachment.uploading && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-xs"
              aria-label={`Remove ${attachment.file.name}`}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function MessageImageLightbox({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Close preview"
        autoFocus
      >
        <X size={24} />
      </button>
      <div
        className="relative max-h-[85vh] max-w-[90vw]"
        style={{ width: "90vw", height: "85vh" }}
        onClick={(event) => event.stopPropagation()}
      >
        <Image
          src={imageUrl}
          alt=""
          fill
          className="object-contain"
          sizes="90vw"
          priority
        />
      </div>
    </div>
  );
}
