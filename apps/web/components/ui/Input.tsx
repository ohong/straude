import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  errorId?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, errorId, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={error || undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        className={cn(
          "w-full rounded-[4px] border bg-input px-4 py-3 text-base text-foreground placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-150",
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

Input.displayName = "Input";
