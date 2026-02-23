"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { COUNTRIES, countryFlag } from "@/lib/constants/regions";
import { cn } from "@/lib/utils/cn";

interface CountryPickerProps {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  name?: string;
}

export function CountryPicker({ value, onChange, id, name }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = COUNTRIES.find((c) => c.code === value);

  const filtered = search
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      )
    : COUNTRIES;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // Focus search input and set initial highlight when opened
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      const idx = value ? COUNTRIES.findIndex((c) => c.code === value) : 0;
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${highlight}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  function handleSelect(code: string) {
    onChange(code);
    setOpen(false);
    setSearch("");
  }

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlight(0);
  }, [search]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0) {
        handleSelect(filtered[highlight]!.code);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {name && <input type="hidden" name={name} value={value} />}

      {open ? (
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={"Search for a country\u2026"}
          className="w-full rounded-[4px] border border-accent bg-white px-4 py-3 text-base text-foreground placeholder:text-muted outline-none ring-3 ring-accent/15"
          autoComplete="off"
        />
      ) : (
        <button
          type="button"
          id={id}
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-center rounded-[4px] border border-border bg-white px-4 py-3 text-left text-base outline-none transition-[border-color,box-shadow] duration-150",
            "focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/15",
            selected ? "text-foreground" : "text-muted",
          )}
        >
          <span className="flex-1 truncate">
            {selected
              ? `${countryFlag(selected.code)} ${selected.name}`
              : "Select a country"}
          </span>
          {selected ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="ml-2 flex-shrink-0 text-muted hover:text-foreground"
              aria-label="Clear country"
            >
              <X size={16} />
            </span>
          ) : (
            <ChevronDown size={16} className="ml-2 flex-shrink-0 text-muted" aria-hidden />
          )}
        </button>
      )}

      {open && (
        <ul
          ref={listRef}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-[4px] border border-border bg-white shadow-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No countries found</li>
          ) : (
            filtered.map((c, i) => (
              <li key={c.code}>
                <button
                  type="button"
                  data-index={i}
                  onClick={() => handleSelect(c.code)}
                  onPointerEnter={() => setHighlight(i)}
                  className={cn(
                    "w-full px-4 py-2 text-left text-sm",
                    i === highlight ? "bg-hover" : "",
                    c.code === value && "bg-highlight-row font-medium",
                  )}
                >
                  {countryFlag(c.code)} {c.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
