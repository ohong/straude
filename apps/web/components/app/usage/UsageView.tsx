"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  formatCurrency,
  formatPercent,
  formatTokens,
} from "@/lib/utils/format";
import {
  USAGE_WINDOW_DAYS,
  rankTools,
  summarizeUsage,
  windowStart,
  type UsageMetric,
  type UsageViewData,
  type UsageWindowDays,
} from "@/lib/usage-view";
import { FirstSyncCommandCard } from "@/components/app/activation/FirstSyncCommandCard";
import { UsageChart, formatUsageDay } from "./UsageChart";
import { UsageShareBar } from "./UsageShareBar";
import { inkColor, toolColors, toolLabel } from "./usage-tools";

const WINDOW_OPTIONS = USAGE_WINDOW_DAYS.map((days) => ({
  value: days,
  label: `${days} days`,
}));

const METRIC_OPTIONS = [
  { value: "cost", label: "Cost" },
  { value: "tokens", label: "Tokens" },
] as const;

const BREAKDOWN_OPTIONS = [
  { value: "model", label: "Model" },
  { value: "day", label: "Day" },
] as const;

function dayCount(count: number): string {
  return `${count} day${count === 1 ? "" : "s"}`;
}

function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded border border-border p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-sm px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            value === option.value
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function UsageView({
  data,
  initialWindowDays,
  initialMetric,
}: {
  data: UsageViewData | null;
  initialWindowDays: UsageWindowDays;
  initialMetric: UsageMetric;
}) {
  const [windowDays, setWindowDays] = useState<UsageWindowDays>(initialWindowDays);
  const [metric, setMetric] = useState<UsageMetric>(initialMetric);
  const [tool, setTool] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<"model" | "day">("model");

  const rankedTools = useMemo(() => (data ? rankTools(data.rows) : []), [data]);
  const colors = useMemo(() => toolColors(rankedTools), [rankedTools]);

  const selectWindow = (days: UsageWindowDays) => {
    setWindowDays(days);
    window.history.replaceState(null, "", `?range=${days}&metric=${metric}`);
  };
  const selectMetric = (next: UsageMetric) => {
    setMetric(next);
    window.history.replaceState(null, "", `?range=${windowDays}&metric=${next}`);
  };

  const end = data?.end;
  const start = end === undefined ? "" : windowStart(end, windowDays);
  const summary =
    data && end !== undefined
      ? summarizeUsage(data.rows, { start, end, metric, tool })
      : null;

  const formatValue =
    metric === "cost"
      ? (value: number) => `$${formatCurrency(value)}`
      : formatTokens;

  const header = (
    <header className="min-h-14 border-b border-border px-[var(--app-page-padding-x)]">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 py-1.5">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Usage</h1>
          <select
            aria-label="Tool"
            value={tool ?? ""}
            onChange={(event) => setTool(event.target.value || null)}
            className="cursor-pointer rounded-sm bg-transparent text-sm text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <option value="">All tools</option>
            {rankedTools.map((name) => (
              <option key={name} value={name}>
                {toolLabel(name)}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Usage window"
            value={windowDays}
            options={WINDOW_OPTIONS}
            onChange={selectWindow}
          />
          <SegmentedControl
            label="Usage metric"
            value={metric}
            options={METRIC_OPTIONS}
            onChange={selectMetric}
          />
        </div>
      </div>
    </header>
  );

  return (
    <div className="@container">
      {header}
      <div className="px-[var(--app-page-padding-x)]">
        <div className="mx-auto w-full max-w-5xl">
          {data === null || summary === null ? (
            <p role="alert" className="py-6 text-sm text-muted">
              Unable to load usage. Refresh to try again.
            </p>
          ) : data.rows.length === 0 ? (
            <div className="pt-6">
              <FirstSyncCommandCard surface="feed" />
            </div>
          ) : (
            <div className="flex flex-col gap-8 pt-6 pb-10">
              <section className="grid gap-6 @3xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-5">
                  <div className="flex flex-col gap-1">
                    <p className="font-[family-name:var(--font-mono)] text-4xl font-semibold tabular-nums">
                      {metric === "cost"
                        ? `$${formatCurrency(summary.cost)}`
                        : formatTokens(summary.totalTokens)}
                    </p>
                    <p className="text-xs text-muted">
                      {summary.activeDays} active{" "}
                      {summary.activeDays === 1 ? "day" : "days"}
                      {metric === "cost" ? " · API-rate estimate" : ""}
                    </p>
                  </div>

                  {summary.tools.map((entry) => (
                    <div key={entry.tool} className="flex flex-col gap-1">
                      <dl className="flex items-baseline justify-between gap-4">
                        <dt className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                colors[entry.tool] ?? "var(--color-foreground)",
                            }}
                          />
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="truncate">
                              {toolLabel(entry.tool)}
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-xs text-muted tabular-nums">
                              {dayCount(entry.activeDays)}
                            </span>
                          </span>
                        </dt>
                        <dd className="shrink-0 text-sm font-medium tabular-nums">
                          {metric === "cost"
                            ? `$${formatCurrency(entry.cost)}`
                            : formatTokens(entry.totalTokens)}
                        </dd>
                      </dl>
                      <p className="text-xs text-muted">
                        {metric === "cost"
                          ? `${formatPercent(entry.costShare)} of cost · ${formatTokens(entry.totalTokens)} tokens`
                          : `${formatPercent(entry.tokenShare)} of tokens · $${formatCurrency(entry.cost)}`}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <h2 className="text-sm font-medium">
                    {metric === "cost"
                      ? "Daily cost"
                      : "Daily processed tokens"}
                  </h2>
                  <UsageChart
                    days={summary.days}
                    tools={summary.tools.map((entry) => entry.tool)}
                    colors={colors}
                    metric={metric}
                    formatValue={formatValue}
                  />
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium">Totals</h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 @3xl:grid-cols-5">
                  <Metric
                    label="Processed tokens"
                    value={formatTokens(summary.totalTokens)}
                  />
                  <Metric
                    label="Cached input"
                    value={formatTokens(summary.tokens.cacheRead)}
                  />
                  <Metric
                    label="Uncached input"
                    value={formatTokens(summary.tokens.input)}
                  />
                  <Metric
                    label="Output"
                    value={formatTokens(
                      summary.tokens.output + summary.tokens.reasoning,
                    )}
                  />
                  <Metric
                    label="Cache hit rate"
                    value={
                      summary.cacheHitRate === null
                        ? "–"
                        : formatPercent(summary.cacheHitRate)
                    }
                  />
                </dl>
              </section>

              {summary.totalTokens > 0 ? (
                <section className="grid gap-x-12 gap-y-8 @3xl:grid-cols-2">
                  <UsageShareBar
                    label={
                      metric === "cost" ? "Cost by tool" : "Tokens by tool"
                    }
                    segments={summary.tools.map((entry) => ({
                      label: toolLabel(entry.tool),
                      value:
                        metric === "cost" ? entry.cost : entry.totalTokens,
                      color:
                        colors[entry.tool] ?? "var(--color-foreground)",
                    }))}
                    format={formatValue}
                  />
                  <UsageShareBar
                    label="Tokens by type"
                    segments={[
                      {
                        label: "Input",
                        value: summary.tokens.input,
                        color: inkColor(60),
                      },
                      {
                        label: "Cache read",
                        value: summary.tokens.cacheRead,
                        color: inkColor(30),
                      },
                      {
                        label: "Cache write",
                        value: summary.tokens.cacheWrite,
                        color: inkColor(72),
                      },
                      {
                        label: "Output",
                        value: summary.tokens.output,
                        color: inkColor(100),
                      },
                      {
                        label: "Reasoning",
                        value: summary.tokens.reasoning,
                        color: inkColor(85),
                      },
                      {
                        label: "Unattributed",
                        value: summary.tokens.other,
                        color: inkColor(44),
                      },
                    ]}
                    format={formatTokens}
                  />
                </section>
              ) : null}

              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-medium">Breakdown</h2>
                  <SegmentedControl
                    label="Usage breakdown"
                    value={breakdown}
                    options={BREAKDOWN_OPTIONS}
                    onChange={setBreakdown}
                  />
                </div>

                {breakdown === "model" ? (
                  <ModelBreakdownTable
                    models={summary.models}
                    metric={metric}
                    colors={colors}
                  />
                ) : (
                  <DayBreakdownTable
                    days={summary.days}
                    tools={summary.tools}
                    metric={metric}
                  />
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelBreakdownTable({
  models,
  metric,
  colors,
}: {
  models: ReturnType<typeof summarizeUsage>["models"];
  metric: UsageMetric;
  colors: Record<string, string>;
}) {
  const peak = models.reduce(
    (max, model) =>
      Math.max(max, metric === "cost" ? model.cost : model.totalTokens),
    0,
  );

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-right text-xs text-muted">
          <th scope="col" className="py-2 pr-3 pl-2 text-left font-normal">
            #
          </th>
          <th scope="col" className="w-full py-2 text-left font-normal">
            Model
          </th>
          <th scope="col" className="py-2 pl-6 font-normal">
            Cost
          </th>
          <th
            scope="col"
            className="hidden py-2 pl-6 font-normal @xl:table-cell"
          >
            Share
          </th>
          <th scope="col" className="py-2 pr-2 pl-6 font-normal">
            Tokens
          </th>
        </tr>
      </thead>
      <tbody>
        {models.length === 0 ? (
          <tr>
            <td colSpan={5} className="py-6 text-center text-muted">
              No activity in this window.
            </td>
          </tr>
        ) : (
          models.map((model, index) => {
            const value =
              metric === "cost" ? model.cost : model.totalTokens;
            const share =
              metric === "cost" ? model.costShare : model.tokenShare;
            const hasBar = value > 0 && peak > 0;
            const color =
              colors[model.tool] ?? "var(--color-foreground)";
            return (
              <tr
                key={`${model.tool}:${model.model}`}
                className="border-b border-border/50 text-right whitespace-nowrap text-muted tabular-nums"
              >
                <td className="py-2.5 pr-3 pl-2 text-left text-xs">
                  {index + 1}
                </td>
                <td className="py-2.5 text-left whitespace-normal">
                  <span className="flex items-center gap-2 text-foreground">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">
                      {model.model === "" ? "Unattributed" : model.model}
                    </span>
                  </span>
                  {hasBar ? (
                    <div aria-hidden className="mt-1.5 h-0.5 max-w-48">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `max(0.5rem, ${(value / peak) * 100}%)`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  ) : null}
                </td>
                <td className="py-2.5 pl-6 text-foreground">
                  {`$${formatCurrency(model.cost)}`}
                </td>
                <td className="hidden py-2.5 pl-6 @xl:table-cell">
                  {formatPercent(share)}
                </td>
                <td className="py-2.5 pr-2 pl-6">
                  {model.totalTokens > 0
                    ? formatTokens(model.totalTokens)
                    : "–"}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

function DayBreakdownTable({
  days,
  tools,
  metric,
}: {
  days: ReturnType<typeof summarizeUsage>["days"];
  tools: ReturnType<typeof summarizeUsage>["tools"];
  metric: UsageMetric;
}) {
  const rows = days
    .toReversed()
    .filter((day) => day.cost > 0 || day.totalTokens > 0);

  const metricValue = (value: { cost: number; totalTokens: number }) =>
    metric === "cost" ? value.cost : value.totalTokens;
  const formatMetric = (value: number) =>
    metric === "cost" ? `$${formatCurrency(value)}` : formatTokens(value);
  const otherMetricValue = (day: (typeof rows)[number]) =>
    metric === "cost" ? day.totalTokens : day.cost;
  const formatOther = (value: number) =>
    metric === "cost" ? formatTokens(value) : `$${formatCurrency(value)}`;

  return (
    <div
      role="region"
      aria-label="Usage breakdown by day"
      tabIndex={0}
      className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    >
      <table className="w-full text-sm whitespace-nowrap">
        <colgroup>
          <col className="w-2/5" />
        </colgroup>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th scope="col" className="py-2 pl-2 font-normal">
              Day
            </th>
            {tools.map((entry) => (
              <th
                key={entry.tool}
                scope="col"
                className="py-2 pl-4 text-right font-normal"
              >
                {toolLabel(entry.tool)}
              </th>
            ))}
            <th scope="col" className="py-2 pl-4 text-right font-normal">
              Total
            </th>
            <th scope="col" className="py-2 pr-2 pl-4 text-right font-normal">
              {metric === "cost" ? "Tokens" : "Cost"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={tools.length + 3}
                className="py-6 text-center text-muted"
              >
                No activity in this window.
              </td>
            </tr>
          ) : (
            rows.map((day) => (
              <tr
                key={day.date}
                className="border-b border-border/50 transition-colors hover:bg-hover"
              >
                <td className="py-2 pl-2 text-foreground">
                  {formatUsageDay(day.date)}
                </td>
                {tools.map((entry) => {
                  const cell = day.byTool[entry.tool];
                  const value = cell ? metricValue(cell) : 0;
                  return (
                    <td
                      key={entry.tool}
                      className="py-2 pl-4 text-right text-muted tabular-nums"
                    >
                      {cell && value > 0 ? formatMetric(value) : "–"}
                    </td>
                  );
                })}
                <td className="py-2 pl-4 text-right text-foreground tabular-nums">
                  {formatMetric(metricValue(day))}
                </td>
                <td className="py-2 pr-2 pl-4 text-right text-muted tabular-nums">
                  {formatOther(otherMetricValue(day))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
