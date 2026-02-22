"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { getMentionQuery } from "@/lib/utils/mentions";

interface MentionUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  onSubmit?: () => void;
  className?: string;
  disabled?: boolean;
}

export function MentionInput({
  value,
  onChange,
  placeholder,
  maxLength,
  multiline,
  onSubmit,
  className,
  disabled,
}: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchSuggestions = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/mentions?q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      );
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.users ?? []);
      setActiveIndex(0);
    } catch {
      // aborted or network error — ignore
    }
  }, []);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart ?? newValue.length;
    const q = getMentionQuery(newValue, cursorPos);
    setMentionQuery(q);

    if (q !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(q), 200);
    } else {
      setSuggestions([]);
    }
  }

  function selectUser(user: MentionUser) {
    const el = inputRef.current;
    if (!el) return;

    const cursorPos = el.selectionStart ?? value.length;
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);

    // Find the @ that started this mention
    const atMatch = before.match(/(?:^|\s)@([a-zA-Z0-9_-]{0,39})$/);
    if (!atMatch) return;

    const atStart = before.length - atMatch[0].length + (atMatch[0].startsWith("@") ? 0 : 1);
    const newValue =
      value.slice(0, atStart) + `@${user.username} ` + after;
    onChange(newValue);
    setSuggestions([]);
    setMentionQuery(null);

    // Restore focus
    requestAnimationFrame(() => {
      const newCursorPos = atStart + user.username.length + 2; // @username + space
      el.focus();
      el.setSelectionRange(newCursorPos, newCursorPos);
    });
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectUser(suggestions[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestions([]);
        setMentionQuery(null);
        return;
      }
    }

    // Submit on Enter (single-line) or Cmd/Ctrl+Enter (multiline)
    if (e.key === "Enter" && onSubmit) {
      if (!multiline && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      } else if (multiline && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSubmit();
      }
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setSuggestions([]);
        setMentionQuery(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearTimeout(debounceRef.current);
    };
  }, []);

  const sharedProps = {
    ref: inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>,
    value,
    onChange: handleInputChange,
    onKeyDown: handleKeyDown,
    placeholder,
    maxLength,
    disabled,
    className:
      className ??
      "w-full border border-border px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent",
    style: { borderRadius: 4 } as React.CSSProperties,
  };

  return (
    <div className="relative flex-1">
      {multiline ? (
        <textarea {...sharedProps} rows={4} />
      ) : (
        <input {...(sharedProps as React.InputHTMLAttributes<HTMLInputElement>)} />
      )}

      {suggestions.length > 0 && mentionQuery !== null && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden border border-border bg-background shadow-lg"
          style={{ borderRadius: 6 }}
        >
          {suggestions.map((user, i) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                selectUser(user);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                i === activeIndex ? "bg-subtle" : "hover:bg-subtle"
              }`}
            >
              <Avatar src={user.avatar_url} alt={user.username} size="xs" fallback={user.username} />
              <span className="font-semibold">@{user.username}</span>
              {user.display_name && (
                <span className="truncate text-muted">
                  {user.display_name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
