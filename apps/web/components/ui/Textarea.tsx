import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  errorId?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, errorId, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={error || undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        className={cn(
          "min-h-[100px] w-full resize-y rounded-[4px] border bg-input px-4 py-3 text-base text-foreground placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-150",
          error
            ? "border-error"
            : "border-border focus:border-accent focus:ring-3 focus:ring-accent/15",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
