import { redirect } from "next/navigation";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { loadUsageView } from "@/lib/data/usage-view";
import {
  USAGE_WINDOW_DAYS,
  type UsageMetric,
  type UsageWindowDays,
} from "@/lib/usage-view";
import { UsageView } from "@/components/app/usage/UsageView";

function parseWindowDays(value: string | string[] | undefined): UsageWindowDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const days = Number(raw);
  return (USAGE_WINDOW_DAYS as readonly number[]).includes(days)
    ? (days as UsageWindowDays)
    : 30;
}

function parseMetric(value: string | string[] | undefined): UsageMetric {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "tokens" ? "tokens" : "cost";
}

export default async function UsageRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[]; metric?: string | string[] }>;
}) {
  const identity = await getAuthIdentity();

  if (!identity) {
    redirect("/login");
  }

  const db = getServiceClient();
  const [{ range, metric }, { data: profile }] = await Promise.all([
    searchParams,
    db.from("users").select("timezone").eq("id", identity.id).single(),
  ]);

  const usage = await loadUsageView(db, identity.id, profile?.timezone).catch(
    (error) => {
      console.error("[usage] Failed to load usage view:", error);
      return null;
    },
  );

  return (
    <UsageView
      data={usage}
      initialWindowDays={parseWindowDays(range)}
      initialMetric={parseMetric(metric)}
    />
  );
}
