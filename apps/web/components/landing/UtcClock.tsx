"use client";

import { useEffect, useState } from "react";

export function UtcClock() {
  const [utc, setUtc] = useState("UTC 00:00");

  useEffect(() => {
    function tick() {
      setUtc(`UTC ${new Date().toISOString().substring(11, 16)}`);
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return <span suppressHydrationWarning>{utc}</span>;
}
