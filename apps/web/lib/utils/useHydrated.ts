"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Browser-only values become readable after React matches the server markup.
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
