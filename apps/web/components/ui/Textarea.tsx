import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-[4px] border bg-white px-4 py-3 text-base text-foreground placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-150 resize-y min-h-[100px]",
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
