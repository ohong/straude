"use client";

import dynamic from "next/dynamic";

const Agentation = dynamic(
  () => import("agentation").then((module) => module.Agentation),
  { ssr: false },
);

export function DevAgentation() {
  if (process.env.NODE_ENV !== "development") return null;
  return <Agentation />;
}
